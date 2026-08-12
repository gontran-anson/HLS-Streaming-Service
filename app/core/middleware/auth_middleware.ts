import { TokenVerifier } from '#common/services/token_verifier'
import { UnauthencatedException } from '#common/exceptions/unauthencated_exception'
import { bearerToken } from '#common/utils/bearer_token'
import { resolveLang } from '#common/utils/request_lang'
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Gates a route behind delegated token verification (ADR-0003, jalon H).
 *
 * Reads the bearer token, verifies it against the configured endpoint (cached),
 * and lets the request through only if valid — otherwise 401. The service stays
 * ignorant of identities: a valid token is enough (Q13), no per-owner check.
 */
@inject()
export default class AuthMiddleware {
  constructor(private tokenVerifier: TokenVerifier) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const token = bearerToken(ctx.request)
    if (!token || !(await this.tokenVerifier.verify(token))) {
      throw new UnauthencatedException(resolveLang(ctx.request))
    }

    return next()
  }
}
