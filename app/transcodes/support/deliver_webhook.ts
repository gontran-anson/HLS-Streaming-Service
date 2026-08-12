import type { WebhookJobData } from '#transcodes/queues/webhook_queue'
import { createHmac } from 'node:crypto'

/** How long we wait for the caller endpoint before aborting the delivery. */
const WEBHOOK_TIMEOUT_MS = 10_000

/** Header carrying the `sha256=<hex>` HMAC of the exact body, when a secret is set. */
export const SIGNATURE_HEADER = 'X-Transcode-Signature'

/**
 * POSTs the frozen payload as JSON to the caller URL (jalon I, ADR-0005).
 *
 * Signs the **exact** JSON string it sends with the per-upload secret (HMAC
 * SHA-256) when one is present — no secret, no signature header. Success is any
 * 2xx; anything else (or a timeout) throws so BullMQ retries with backoff.
 */
export async function deliverWebhook(data: WebhookJobData): Promise<void> {
  const body = JSON.stringify(data.payload)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (data.callbackSecret) {
    const signature = createHmac('sha256', data.callbackSecret).update(body).digest('hex')
    headers[SIGNATURE_HEADER] = `sha256=${signature}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    const response = await fetch(data.callbackUrl, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`webhook responded ${response.status}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}
