import { rustfsBucket, rustfsClient } from '#config/rustfs'
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { DOWNLOAD_FORMAT } from '#transcodes/support/hls'
import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'

const CONTENT_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.flac': 'audio/flac',
  // Progressive download renditions (ADR-0009); derived from the format so a
  // codec/container change stays a one-line edit in hls.ts.
  [`.${DOWNLOAD_FORMAT.extension}`]: DOWNLOAD_FORMAT.contentType,
}

/** S3 caps a single DeleteObjects call at 1000 keys. */
const DELETE_BATCH = 1000

/**
 * Pushes a Transcode's artifacts to RustFS (ADR-0004) — the whole HLS output
 * directory (so Caddy can serve it as the origin) and the single FLAC archive —
 * and takes them back (ADR-0008).
 *
 * Both directions are idempotent: re-putting the same keys on a retry is
 * harmless (so a RustFS hiccup can be retried without re-encoding), and
 * deleting what is already gone is a no-op (so a purge that reruns after a
 * timeout is safe).
 */
export class RustfsStorage {
  /** Uploads every file under `localDir` to `<keyPrefix>/<relative-path>`. */
  async uploadDirectory(localDir: string, keyPrefix: string): Promise<void> {
    const entries = await readdir(localDir, { recursive: true, withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const absolute = join(entry.parentPath, entry.name)
      const key = `${keyPrefix}/${relative(localDir, absolute).split(sep).join('/')}`
      await this.put(key, absolute)
    }
  }

  /** Uploads a single file to an exact key. */
  async uploadFile(localPath: string, key: string): Promise<void> {
    await this.put(key, localPath)
  }

  /**
   * Deletes every object under a **directory-like** prefix, and returns how many
   * were removed (ADR-0008).
   *
   * The prefix is normalized to end with exactly one `/`, so `hls/<id>` removes
   * `hls/<id>/master.m3u8` and never touches a sibling whose name merely starts
   * the same — a prefix delete that can bleed into a neighbour is not a delete,
   * it is an outage.
   *
   * Listing is paginated (a two-hour sermon is well past one page) and deletion
   * is batched. A prefix with nothing under it deletes nothing and is **not** an
   * error: the caller may legitimately be deleting twice.
   */
  async deletePrefix(keyPrefix: string): Promise<number> {
    const prefix = `${keyPrefix.replace(/\/+$/, '')}/`
    let continuationToken: string | undefined
    let deleted = 0

    do {
      const listing = await rustfsClient.send(
        new ListObjectsV2Command({
          Bucket: rustfsBucket,
          Prefix: prefix,
          MaxKeys: DELETE_BATCH,
          ContinuationToken: continuationToken,
        })
      )

      const keys = (listing.Contents ?? []).flatMap((object) => (object.Key ? [object.Key] : []))
      if (keys.length > 0) {
        await rustfsClient.send(
          new DeleteObjectsCommand({
            Bucket: rustfsBucket,
            Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
          })
        )
        deleted += keys.length
      }

      // Deleting as we page shifts the listing under our feet, so we only follow
      // the token S3 hands back — never re-list from the start.
      continuationToken = listing.IsTruncated ? listing.NextContinuationToken : undefined
    } while (continuationToken)

    return deleted
  }

  /**
   * Deletes a single object by exact key. S3 delete is idempotent: a key that is
   * not there succeeds, which is what makes a missing archive a non-event
   * (ADR-0007 — a URL ingestion never produced one).
   */
  async deleteObject(key: string): Promise<void> {
    await rustfsClient.send(new DeleteObjectCommand({ Bucket: rustfsBucket, Key: key }))
  }

  private async put(key: string, localPath: string): Promise<void> {
    await rustfsClient.send(
      new PutObjectCommand({
        Bucket: rustfsBucket,
        Key: key,
        Body: await readFile(localPath),
        ContentType: CONTENT_TYPES[extname(localPath)] ?? 'application/octet-stream',
      })
    )
  }
}
