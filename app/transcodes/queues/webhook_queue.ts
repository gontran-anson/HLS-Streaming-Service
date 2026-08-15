import type { TranscodeStatus } from '#transcodes/support/transcode_enums'
import type { DownloadRenditionInfo } from '#transcodes/support/hls'
import { queueConnection } from '#config/queue'
import { Queue } from 'bullmq'

/** The BullMQ queue name for completion-webhook delivery; the worker binds to it. */
export const WEBHOOK_QUEUE = 'webhook'

/**
 * The exact body POSTed to the caller. It extends the unified status shape (see
 * `transcode_transformer.ts`) with the two fields the download feature needs
 * pushed rather than polled (ADR-0009): the media `durationSeconds` and, per
 * rendition, its download URL + byte size. COMPLETED carries `outputPlaylist`
 * and a populated `downloads`; FAILED carries `error` and an empty `downloads`.
 */
export interface WebhookPayload {
  id: string
  status: TranscodeStatus
  progress: number | null
  outputPlaylist: string | null
  error: string | null
  /** ffprobe duration in seconds, or null when the media exposes none. */
  durationSeconds: number | null
  /** The progressive download renditions (URL + byte size); empty on FAILED. */
  downloads: DownloadRenditionInfo[]
}

/**
 * Everything the delivery worker needs without re-reading the DB: the target
 * URL, the optional per-upload HMAC secret, and the frozen payload to send.
 */
export interface WebhookJobData {
  transcodeId: string
  callbackUrl: string
  callbackSecret?: string
  payload: WebhookPayload
}

/**
 * Producer side of the webhook queue. A singleton (see
 * `providers/webhook_provider.ts`) so its Redis connection is opened once and
 * closed on shutdown. Kept separate from the transcode queue so a flaky caller
 * endpoint never back-pressures the encode workers.
 */
export class WebhookQueue {
  private queue = new Queue<WebhookJobData>(WEBHOOK_QUEUE, { connection: queueConnection })

  /**
   * Enqueues one webhook delivery. Retries generously — the caller may be
   * momentarily down — with exponential backoff so a slow endpoint is not
   * hammered.
   */
  async enqueue(data: WebhookJobData): Promise<void> {
    await this.queue.add('webhook', data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
    })
  }

  async close(): Promise<void> {
    await this.queue.close()
  }
}
