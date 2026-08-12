import type Transcode from '#transcodes/models/transcode'
import { progressFromStatus } from '#transcodes/support/transcode_progress'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * The single wire shape of a Transcode (see Q14 of the design): the upload
 * `202`, the status poll and the SSE payload all serialize through here, so
 * there is exactly one contract to keep in sync.
 *
 * `progress` prefers the live Redis value (passed by the reading layer) and
 * falls back to a value derived from the durable status when Redis is silent —
 * 0 for PENDING, 100 for COMPLETED, null for an in-flight job with no value.
 */
export default class TranscodeTransformer extends BaseTransformer<Transcode> {
  constructor(
    resource: Transcode,
    private liveProgress?: number | null
  ) {
    super(resource)
  }

  toObject() {
    return {
      id: this.resource.id,
      status: this.resource.status,
      progress: this.liveProgress ?? progressFromStatus(this.resource.status),
      // Coerced to `null` (not left `undefined`) so the 5-field contract holds
      // whether the model was just created (columns unset in memory) or reloaded.
      outputPlaylist: this.resource.outputPlaylist ?? null,
      error: this.resource.error ?? null,
    }
  }
}
