import type { HttpContext } from '@adonisjs/core/http'

/**
 * Extracts the bearer token from the `Authorization` header, or `null` when it
 * is absent or malformed. Shared by the auth middleware and the SSE channel
 * authorization so both read the token the same way.
 */
export function bearerToken(request: HttpContext['request']): string | null {
  const header = request.header('authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}
