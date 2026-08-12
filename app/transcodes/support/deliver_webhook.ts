import type { WebhookJobData } from '#transcodes/queues/webhook_queue'
import { createHmac } from 'node:crypto'

/** How long we wait for the caller endpoint before aborting the delivery. */
const WEBHOOK_TIMEOUT_MS = 10_000

/** Header carrying the `sha256=<hex>` HMAC of the exact body, when a secret is set. */
export const SIGNATURE_HEADER = 'X-Transcode-Signature'

/** The `sha256=<hex>` HMAC-SHA256 of `body` under `secret` — the header value. */
export function webhookSignature(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

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
    headers[SIGNATURE_HEADER] = webhookSignature(data.callbackSecret, body)
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
