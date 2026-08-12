import { authConfig } from '#config/auth'
import redis from '@adonisjs/redis/services/main'
import { createHash } from 'node:crypto'

const cacheKey = (token: string) => `auth:token:${createHash('sha256').update(token).digest('hex')}`

/**
 * Verifies a bearer token by **delegating** to a configured HTTP endpoint
 * (ADR-0003) — this service never inspects or signs tokens itself.
 *
 * Results are cached in Redis for a short TTL, keyed by a hash of the token
 * (never the raw token), so a client polling status or holding an SSE
 * subscription doesn't hammer the verifier on every request. Both positive and
 * negative outcomes are cached briefly; any network error is a denial.
 */
export class TokenVerifier {
  async verify(token: string): Promise<boolean> {
    const key = cacheKey(token)
    const cached = await redis.get(key)
    if (cached !== null) return cached === '1'

    const ok = await this.callEndpoint(token)
    await redis.set(key, ok ? '1' : '0', 'EX', authConfig.cacheTtlSeconds)
    return ok
  }

  private async callEndpoint(token: string): Promise<boolean> {
    try {
      const response = await fetch(authConfig.verifyUrl, {
        method: authConfig.verifyMethod,
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (response.status !== authConfig.expectedStatus) return false
      if (authConfig.bodyMatch) {
        const body = await response.text()
        return body.includes(authConfig.bodyMatch)
      }
      return true
    } catch {
      return false
    }
  }
}
