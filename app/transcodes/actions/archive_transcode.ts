import Transcode from '#transcodes/models/transcode'
import { RustfsStorage } from '#transcodes/services/rustfs_storage'
import { archivePath, hlsOutputDir } from '#transcodes/support/hls'
import { inject } from '@adonisjs/core'
import { rm } from 'node:fs/promises'

export interface ArchiveTranscodeParams {
  id: string
  sourcePath: string
}

/**
 * Second-stage finalization (ADR-0004): push the FLAC archive to RustFS, record
 * its key, then reclaim local disk — the HLS staging dir and the Source.
 *
 * Runs only after the Transcode is COMPLETED (its HLS is already in RustFS), so
 * deleting the local copies is safe. Order matters: the archive is confirmed
 * **before** anything local is removed. Idempotent — safe to retry.
 */
@inject()
export class ArchiveTranscode {
  constructor(private rustfs: RustfsStorage) {}

  async execute(params: ArchiveTranscodeParams): Promise<void> {
    const transcode = await Transcode.find(params.id)
    if (!transcode) return

    const key = `archives/${params.id}.flac`
    await this.rustfs.uploadFile(archivePath(params.id), key)
    transcode.archiveKey = key
    await transcode.save()

    // The archive is safe and the HLS already serves from RustFS: reclaim disk
    // — the HLS staging, the local FLAC, and the Source.
    await rm(hlsOutputDir(params.id), { recursive: true, force: true })
    await rm(archivePath(params.id), { force: true })
    await rm(params.sourcePath, { force: true })
  }
}
