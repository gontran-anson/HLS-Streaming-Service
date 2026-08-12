import { rustfsBucket, rustfsClient } from '#config/rustfs'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'

const CONTENT_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.flac': 'audio/flac',
}

/**
 * Pushes a Transcode's artifacts to RustFS (ADR-0004): the whole HLS output
 * directory (so Caddy can serve it as the origin) and the single FLAC archive.
 *
 * Uploads are idempotent — re-putting the same keys on a retry is harmless — so
 * a RustFS hiccup can be retried without re-encoding.
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
