import type { MultipartFile } from '@adonisjs/core/bodyparser'
import app from '@adonisjs/core/services/app'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Local landing spot for an uploaded Source (see CONTEXT.md).
 *
 * The Source is ephemeral: it is written to the application disk, read by the
 * worker, then deleted once the Transcode reaches COMPLETED (or FAILED). It is
 * never public — Caddy serves the HLS output from RustFS, never this folder —
 * so it lives outside `public/`.
 *
 * Two safety rules, borrowed from `image_store.ts`:
 *
 * 1. **The client-provided name never reaches the disk.** The file is written
 *    as `<id>.<ext>`, the id being the server-minted UUID v7 of the Transcode.
 *    A traversal attempt (`../../.env`) has nothing to traverse — no part of
 *    the client name enters the path.
 * 2. **The extension comes from the validated `extname`**, already constrained
 *    to the accepted media set by the upload validator.
 */
const SOURCES_ROOT = 'storage/sources'

export class SourceStore {
  /**
   * Writes the uploaded source under the Transcode id and returns its absolute
   * local path.
   *
   * @param file Uploaded file (`request.file('file')`), already size- and
   *   extension-checked by the validator.
   * @param id The Transcode id (UUID v7) — the only thing the on-disk name is
   *   derived from.
   */
  async save(file: MultipartFile, id: string): Promise<string> {
    const fileName = `${id}.${file.extname}`
    await file.move(app.makePath(SOURCES_ROOT), { name: fileName })
    return app.makePath(SOURCES_ROOT, fileName)
  }

  /**
   * Deletes the staged Source of a Transcode, whatever its extension.
   *
   * The extension is not on the row, so the file is found by the only thing that
   * is certain: this class chose the name `<id>.<ext>`, so it is the one that can
   * find it back. Deleting a Transcode that never ran must reclaim its source —
   * that is up to 2 GB per abandoned deposit (issue #24).
   *
   * Only ever looks inside the staging root, so it is a no-op — never a risk —
   * for a URL ingestion, whose Source is the caller's object and is not ours to
   * touch (ADR-0007). Nothing to delete is not an error.
   */
  async removeFor(id: string): Promise<void> {
    const root = app.makePath(SOURCES_ROOT)

    let entries: string[]
    try {
      entries = await readdir(root)
    } catch {
      return // the staging root does not exist yet: nothing was ever staged
    }

    for (const entry of entries.filter((name) => name.startsWith(`${id}.`))) {
      await rm(join(root, entry), { force: true })
    }
  }
}
