import redis from '@adonisjs/redis/services/main'

const TTL_SECONDS = 60 * 60

const key = (id: string) => `transcode:${id}:progress`

/**
 * The volatile progress percentage of a Transcode, in Redis (see CONTEXT.md, Q3).
 *
 * Never persisted to Postgres: it changes several times a second and is thrown
 * away once the job finalizes. The worker writes it (throttled to 1% steps),
 * the status endpoint and the SSE channel read it. A TTL keeps a stale value
 * from lingering if a worker dies mid-encode.
 */
export class ProgressStore {
  async set(id: string, percent: number): Promise<void> {
    await redis.set(key(id), String(percent), 'EX', TTL_SECONDS)
  }

  async get(id: string): Promise<number | null> {
    const value = await redis.get(key(id))
    return value === null ? null : Number(value)
  }

  async clear(id: string): Promise<void> {
    await redis.del(key(id))
  }
}
