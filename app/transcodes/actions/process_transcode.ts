import Transcode from '#transcodes/models/transcode'
import { FfmpegTranscoder } from '#transcodes/services/ffmpeg_transcoder'
import { ProgressStore } from '#transcodes/services/progress_store'
import { TranscodePublisher } from '#transcodes/services/transcode_publisher'
import { NoAudioTrackException } from '#transcodes/exceptions/no_audio_track_exception'
import { masterPlaylistPath, outputPlaylistUrl } from '#transcodes/support/hls'
import { inject } from '@adonisjs/core'
import { existsSync } from 'node:fs'

export interface ProcessTranscodeParams {
  id: string
  sourcePath: string
}

/**
 * Drives one Transcode from PENDING to COMPLETED (see CONTEXT.md, ADR-0004).
 *
 * The only layer that touches the model, and the single place the lifecycle
 * transitions live. Steps: probe (reject a source with no audio as a permanent
 * failure), mark PROCESSING, run the single ffmpeg pass while streaming the
 * percentage to Redis, then mark COMPLETED with the playlist URL and duration.
 *
 * Idempotent with a checkpoint: on a retry where the HLS is already on disk, it
 * skips ffmpeg and just finalizes — a RustFS/transient hiccup never re-spends
 * the CPU (ADR-0004). Note: for now COMPLETED means "encoded locally"; jalon G
 * will gate it on the RustFS push. Deleting the source is jalon G's job.
 */
@inject()
export class ProcessTranscode {
  constructor(
    private transcoder: FfmpegTranscoder,
    private progressStore: ProgressStore,
    private publisher: TranscodePublisher
  ) {}

  async execute(params: ProcessTranscodeParams): Promise<void> {
    const transcode = await Transcode.findOrFail(params.id)

    if (!existsSync(masterPlaylistPath(params.id))) {
      const probe = await this.transcoder.probe(params.sourcePath)
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
        params.sourcePath,
        params.id,
        probe.durationSeconds,
        (percent) => {
          if (percent > lastPercent) {
            lastPercent = percent
            // Best-effort: a Redis hiccup must not fail the encode.
            void this.progressStore.set(params.id, percent).catch(() => {})
            this.publisher.broadcast(transcode, percent)
          }
        }
      )
    }

    transcode.status = 'COMPLETED'
    transcode.outputPlaylist = outputPlaylistUrl(params.id)
    await transcode.save()
    await this.progressStore.set(params.id, 100)
    this.publisher.broadcast(transcode, 100)
  }
}
