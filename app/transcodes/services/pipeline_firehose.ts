import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { Redis } from 'ioredis'

/** Raw Redis pub/sub channel the pipeline observability plane listens on. */
export const PIPELINE_EVENTS_CHANNEL = 'pipeline:events'

/**
 * One raw firehose event — the lifecycle-relevant subset of the unified
 * Transcode contract, keyed by `transcodeId` so a downstream enricher can map
 * it back to its media deposit.
 */
export interface PipelineFirehoseEvent {
  transcodeId: string
  status: string
  progress: number | null
  error: string | null
  outputPlaylist: string | null
}

/**
 * Publishes raw Transcode lifecycle events on a Redis pub/sub channel
 * (`pipeline:events`) for the ops observability plane — a firehose that is
 * *in addition to* the per-resource Transmit SSE channel.
 *
 * It opens its own lazy ioredis client on the same Redis the BullMQ queue uses
 * (the `REDIS_*` env, config/queue.ts). Strictly best-effort: a Redis hiccup is
 * caught and logged, never thrown, so it can never fail an encode.
 */
export class PipelineFirehose {
  private client?: Redis

  private connection(): Redis {
    if (!this.client) {
      this.client = new Redis({
        host: env.get('REDIS_HOST'),
        port: env.get('REDIS_PORT'),
        password: env.get('REDIS_PASSWORD') || undefined,
        // Fire-and-forget publisher: don't retry forever if Redis is unreachable.
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      })
    }
    return this.client
  }

  async publish(event: PipelineFirehoseEvent): Promise<void> {
    try {
      await this.connection().publish(PIPELINE_EVENTS_CHANNEL, JSON.stringify(event))
    } catch (error) {
      logger.error(
        { err: error, transcodeId: event.transcodeId },
        'pipeline firehose publish failed'
      )
    }
  }
}
