import { TranscodeQueue } from '#transcodes/queues/transcode_queue'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * `GET /ops/pipeline` — read-only snapshot of the transcode pipeline for the
 * ops observability page on the application server. Gated by the same delegated
 * token verification as ingest (jalon H): the caller presents the shared
 * `STREAMING_SERVICE_TOKEN` as its bearer, verified against `AUTH_VERIFY_URL`.
 *
 * Everything comes from BullMQ (ADR-0008: the queue, not the `status` column, is
 * the live truth), so this observes without touching Postgres or RustFS.
 */
@inject()
export default class GetOpsPipelineController {
  constructor(private transcodeQueue: TranscodeQueue) {}

  /**
   * @handle
   * @summary Ops pipeline snapshot
   * @operationId opsPipeline
   * @description Read-only counts, active jobs and recent failures straight from
   * the BullMQ transcode queue, for the live pipeline observability page.
   * @responseBody 200 - {"counts":{"waiting":0,"active":0,"failed":0},"active":[],"recentFailures":[]}
   * @responseBody 401 - {"code":"E_UNAUTHORIZED"}
   */
  async handle({ response }: HttpContext) {
    const [counts, active, recentFailures] = await Promise.all([
      this.transcodeQueue.jobCounts(),
      this.transcodeQueue.activeJobs(),
      this.transcodeQueue.recentFailures(),
    ])

    return response.ok({ counts, active, recentFailures })
  }
}
