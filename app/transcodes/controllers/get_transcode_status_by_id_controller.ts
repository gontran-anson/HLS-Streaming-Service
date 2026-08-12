import type { HttpContext } from '@adonisjs/core/http'

/**
 * `GET /transcodes/:id/status` — point-in-time status poll.
 *
 * Implemented in jalon C (#3): merge the durable Postgres status with the
 * volatile Redis progress, 404 on unknown id, payload identical to the SSE
 * shape (via TranscodeTransformer). Stub for now.
 */
export default class GetTranscodeStatusByIdController {
  async handle({ params }: HttpContext) {
    return { id: params.id }
  }
}
