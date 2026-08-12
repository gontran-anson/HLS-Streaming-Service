import type Transcode from '#transcodes/models/transcode'
import TranscodeTransformer from '#transcodes/transformers/transcode_transformer'
import logger from '@adonisjs/core/services/logger'
import transmit from '@adonisjs/transmit/services/main'

/**
 * Pushes the unified Transcode wire payload to SSE subscribers in real time
 * (jalon F, #6) on the per-resource channel `transcodes/<id>`.
 *
 * The payload is built through `TranscodeTransformer` — the exact shape the
 * status poll serves (`id, status, progress, outputPlaylist, error`) — so a live
 * client and a polling client see one contract.
 *
 * Broadcasting is routed through Transmit's Redis transport (config/transmit.ts)
 * so a push from the worker process reaches SSE clients on the HTTP server.
 * Best-effort, mirroring `ProgressStore`: a transport hiccup must never fail an
 * encode, so it is caught and logged rather than thrown.
 */
export class TranscodePublisher {
  broadcast(transcode: Transcode, liveProgress?: number | null): void {
    const payload = new TranscodeTransformer(transcode, liveProgress).toObject()
    try {
      transmit.broadcast(`transcodes/${payload.id}`, payload)
    } catch (error) {
      logger.error({ err: error, transcodeId: payload.id }, 'transcode broadcast failed')
    }
  }
}
