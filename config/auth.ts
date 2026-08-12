import env from '#start/env'

/**
 * Delegated token verification (ADR-0003).
 *
 * This service holds **no** auth knowledge of its own: a middleware relays the
 * incoming bearer token to `AUTH_VERIFY_URL` and treats the request as
 * authenticated when the response matches — the expected status, and optionally
 * a substring the body must contain. Point it at `new-life-server` or any other
 * verifier without touching code.
 */
export const authConfig = {
  verifyUrl: env.get('AUTH_VERIFY_URL'),
  verifyMethod: env.get('AUTH_VERIFY_METHOD', 'GET'),
  expectedStatus: env.get('AUTH_VERIFY_STATUS', 200),
  /** Optional: the response body must contain this string to count as valid. */
  bodyMatch: env.get('AUTH_VERIFY_BODY_MATCH'),
  /** Short cache to absorb polling/SSE bursts against the verifier (Q13). */
  cacheTtlSeconds: env.get('AUTH_CACHE_TTL', 60),
} as const
