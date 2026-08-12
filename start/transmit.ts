import { TokenVerifier } from '#common/services/token_verifier'
import { bearerToken } from '#common/utils/bearer_token'
import app from '@adonisjs/core/services/app'
import transmit from '@adonisjs/transmit/services/main'

/**
 * Registers Transmit's SSE endpoints (`__transmit/events`, `__transmit/subscribe`,
 * `__transmit/unsubscribe`) — the client-facing side of the real-time status push
 * (jalon F, #6).
 *
 * The `transcodes/<id>` channel is **authorized** (jalon H, ADR-0003): a client
 * may subscribe only with a valid bearer token, verified against the configured
 * endpoint. Per Q13 any valid token suffices — the service does not tie a channel
 * to an owner. The token travels on the subscribe request's `Authorization` header.
 */
transmit.registerRoutes()

transmit.authorize<{ id: string }>('transcodes/:id', async (ctx) => {
  const token = bearerToken(ctx.request)
  if (!token) return false

  const verifier = await app.container.make(TokenVerifier)
  return verifier.verify(token)
})
