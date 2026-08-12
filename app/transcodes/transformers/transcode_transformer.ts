import type Transcode from '#transcodes/models/transcode'
import { progressFromStatus } from '#transcodes/support/transcode_progress'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * The single wire shape of a Transcode (see Q14 of the design): the upload
 * `202`, the status poll and the SSE payload all serialize through here, so
 * there is exactly one contract to keep in sync.
 *
 * `progress` is derived from the durable status; the live percentage during
 * PROCESSING is merged in from Redis by the reading layer.
 */
export default class TranscodeTransformer extends BaseTransformer<Transcode> {
  toObject() {
    return {
      id: this.resource.id,
      status: this.resource.status,
      progress: progressFromStatus(this.resource.status),
      // Coerced to `null` (not left `undefined`) so the 5-field contract holds
      // whether the model was just created (columns unset in memory) or reloaded.
      outputPlaylist: this.resource.outputPlaylist ?? null,
      error: this.resource.error ?? null,
    }
  }
}
