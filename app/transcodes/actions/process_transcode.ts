import Transcode from '#transcodes/models/transcode'
import { FfmpegTranscoder } from '#transcodes/services/ffmpeg_transcoder'
import { ProgressStore } from '#transcodes/services/progress_store'
import { TranscodePublisher } from '#transcodes/services/transcode_publisher'
import { RustfsStorage } from '#transcodes/services/rustfs_storage'
import { WebhookQueue } from '#transcodes/queues/webhook_queue'
import { ArchiveQueue } from '#transcodes/queues/archive_queue'
import { NoAudioTrackException } from '#transcodes/exceptions/no_audio_track_exception'
import { hlsOutputDir, masterPlaylistPath, outputPlaylistUrl } from '#transcodes/support/hls'
import { inject } from '@adonisjs/core'
import { existsSync } from 'node:fs'

export interface ProcessTranscodeParams {
  id: string
  /** ffmpeg input: a local Source path (upload) or a remote URL (URL ingestion). */
  source: string
  /** true = URL source: ffmpeg reads the URL, no FLAC archive is produced. */
  remote: boolean
}

/**
 * Drives one Transcode from PENDING to COMPLETED (see CONTEXT.md, ADR-0004).
 *
 * The only layer that touches the model, and the single place the lifecycle
 * transitions live. Steps: probe (reject a source with no audio as a permanent
 * failure), mark PROCESSING, run the single ffmpeg pass while streaming the
 * percentage to Redis, then mark COMPLETED with the playlist URL and duration.
 *
 * COMPLETED means **"servable from RustFS"** (ADR-0004, Q18): the local HLS is
 * pushed to RustFS before the transition, and only then is the row marked done.
 * Idempotent with a checkpoint — on a retry where the HLS is already on disk it
 * skips ffmpeg and just re-pushes and finalizes, so a RustFS hiccup never
 * re-spends the CPU. Archiving the FLAC and reclaiming local disk is the
 * separate second job (ArchiveTranscode), enqueued once COMPLETED.
 */
@inject()
export class ProcessTranscode {
  constructor(
    private transcoder: FfmpegTranscoder,
    private progressStore: ProgressStore,
    private publisher: TranscodePublisher,
    private webhookQueue: WebhookQueue,
    private rustfs: RustfsStorage,
    private archiveQueue: ArchiveQueue
  ) {}

  async execute(params: ProcessTranscodeParams): Promise<void> {
    const transcode = await Transcode.findOrFail(params.id)

    if (!existsSync(masterPlaylistPath(params.id))) {
      const probe = await this.transcoder.probe(params.source)
      if (!probe.hasAudio) {
        throw new NoAudioTrackException()
      }

      transcode.status = 'PROCESSING'
      transcode.durationSeconds = probe.durationSeconds
      await transcode.save()
      await this.progressStore.set(params.id, 0)
      this.publisher.broadcast(transcode, 0)

      let lastPercent = 0
      await this.transcoder.encode(
        params.source,
        params.id,
        probe.durationSeconds,
        (percent) => {
          if (percent > lastPercent) {
            lastPercent = percent
            // Best-effort: a Redis hiccup must not fail the encode.
            void this.progressStore.set(params.id, percent).catch(() => {})
            this.publisher.broadcast(transcode, percent)
          }
        },
        // A URL source keeps no FLAC archive — the original lives at the URL.
        { withArchive: !params.remote }
      )
    }

    // Push the HLS to RustFS *before* COMPLETED — the client must be able to
    // play it from the serving origin the moment we say it's ready (Q18).
    await this.rustfs.uploadDirectory(hlsOutputDir(params.id), `hls/${params.id}`)

    transcode.status = 'COMPLETED'
    transcode.outputPlaylist = outputPlaylistUrl(params.id)
    await transcode.save()
    await this.progressStore.set(params.id, 100)
    this.publisher.broadcast(transcode, 100)

    // Completion webhook (jalon I): notify the caller URL, if any, of the
    // terminal COMPLETED state via a dedicated retrying delivery job.
    if (transcode.callbackUrl) {
      await this.webhookQueue.enqueue({
        transcodeId: transcode.id,
        callbackUrl: transcode.callbackUrl,
        callbackSecret: transcode.callbackSecret ?? undefined,
        payload: {
          id: transcode.id,
          status: transcode.status,
          progress: 100,
          outputPlaylist: transcode.outputPlaylist,
          error: null,
        },
      })
    }

    // Second stage (ADR-0004): archive the FLAC (uploads only) and reclaim local
    // disk. A separate job so a RustFS outage retries without re-encoding.
    await this.archiveQueue.enqueue({
      id: params.id,
      source: params.source,
      remote: params.remote,
    })
  }
}
