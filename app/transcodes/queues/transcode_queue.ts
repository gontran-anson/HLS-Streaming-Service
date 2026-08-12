import type { SourceKind } from '#transcodes/support/transcode_enums'
import { queueConnection } from '#config/queue'
import { Queue } from 'bullmq'

/** The single BullMQ queue name; the worker binds to the same string. */
export const TRANSCODE_QUEUE = 'transcode'

/**
 * Everything the worker needs to process a Transcode without re-reading the DB.
 * `source` is the ffmpeg input — a local path for an upload, or a remote URL for
 * a URL ingestion; `remote` tells the worker whether there is a local Source to
 * clean up and a FLAC archive to produce.
 */
export interface TranscodeJobData {
  id: string
  source: string
  sourceKind: SourceKind
  remote: boolean
}

/**
 * Producer side of the transcode queue — the only thing the HTTP path touches.
 * A singleton (see `providers/queue_provider.ts`) so its Redis connection is
 * opened once and closed on shutdown.
 */
export class TranscodeQueue {
  private queue = new Queue<TranscodeJobData>(TRANSCODE_QUEUE, { connection: queueConnection })

  /**
   * Enqueues a transcode job. The job id **is** the Transcode id (ADR-0002),
   * so re-submitting the same upload is idempotent — BullMQ drops a duplicate
   * jobId rather than transcoding twice.
   */
  async enqueue(data: TranscodeJobData): Promise<void> {
    await this.queue.add('transcode', data, {
      jobId: data.id,
      // Transient failures (OOM, I/O) retry with backoff; a permanent failure
      // (no audio track) is thrown as unrecoverable and skips these (Q9).
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    })
  }

  async close(): Promise<void> {
    await this.queue.close()
  }
}
