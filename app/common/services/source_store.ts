import type { MultipartFile } from '@adonisjs/core/bodyparser'
import app from '@adonisjs/core/services/app'

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
}
