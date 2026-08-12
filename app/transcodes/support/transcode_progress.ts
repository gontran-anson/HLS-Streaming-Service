import type { TranscodeStatus } from '#transcodes/support/transcode_enums'

/**
 * The progress a Transcode has by virtue of its durable status alone, when the
 * volatile Redis value is absent (see Q14 of the design).
 *
 * `PROCESSING` returns `null` — an in-flight job with no Redis value is
 * indeterminate, not 0% — so the client shows a spinner, not a stalled bar.
 * The live percentage during PROCESSING is layered on later from Redis.
 */
export function progressFromStatus(status: TranscodeStatus): number | null {
  switch (status) {
    case 'PENDING':
      return 0
    case 'COMPLETED':
      return 100
    case 'PROCESSING':
    case 'FAILED':
      return null
  }
}
