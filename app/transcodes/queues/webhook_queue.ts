import type { TranscodeStatus } from '#transcodes/support/transcode_enums'
import { queueConnection } from '#config/queue'
import { Queue } from 'bullmq'

/** The BullMQ queue name for completion-webhook delivery; the worker binds to it. */
export const WEBHOOK_QUEUE = 'webhook'

/**
 * The unified Transcode wire shape (see `transcode_transformer.ts`) — the exact
 * body POSTed to the caller. COMPLETED carries `outputPlaylist`; FAILED carries
 * `error`.
 */
export interface WebhookPayload {
  id: string
  status: TranscodeStatus
  progress: number | null
  outputPlaylist: string | null
  error: string | null
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
