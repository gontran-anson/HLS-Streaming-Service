import Transcode from '#transcodes/models/transcode'
import { RustfsStorage } from '#transcodes/services/rustfs_storage'
import { archiveKey, archivePath, hlsOutputDir } from '#transcodes/support/hls'
import { inject } from '@adonisjs/core'
import { rm } from 'node:fs/promises'

export interface ArchiveTranscodeParams {
  id: string
  source: string
  remote: boolean
}

/**
 * Second-stage finalization (ADR-0004): push the FLAC archive to RustFS (uploads
 * only), record its key, then reclaim local disk — the HLS staging dir and, for
 * an upload, the local FLAC and Source.
 *
 * For a **URL** ingestion there is no local Source and no FLAC: the original
 * already lives at the URL (recorded as `source_url`), so this step only clears
 * the HLS staging. Runs after COMPLETED (the HLS is already in RustFS); the
 * archive is confirmed **before** anything local is removed. Idempotent.
 */
@inject()
export class ArchiveTranscode {
  constructor(private rustfs: RustfsStorage) {}

  async execute(params: ArchiveTranscodeParams): Promise<void> {
    const transcode = await Transcode.find(params.id)
    if (!transcode) return

    if (!params.remote) {
      const key = archiveKey(params.id)
      await this.rustfs.uploadFile(archivePath(params.id), key)
      transcode.archiveKey = key
      await transcode.save()
    }

    // The HLS already serves from RustFS: reclaim local disk. For an upload,
    // also drop the local FLAC and Source (a URL ingestion has neither).
    await rm(hlsOutputDir(params.id), { recursive: true, force: true })
    if (!params.remote) {
      await rm(archivePath(params.id), { force: true })
      await rm(params.source, { force: true })
    }
  }
}
