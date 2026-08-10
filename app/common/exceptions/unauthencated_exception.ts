import { PlatformLang } from '#common/services/http_service'
import { Exception } from '@adonisjs/core/exceptions'

export class UnauthencatedException extends Exception {
  static status = 401
  static code = 'E_UNAUTHENTICATED'

  constructor(lang: PlatformLang, message?: string) {
    super((message ?? lang === PlatformLang.fr) ? 'Non autorisé' : 'Unauthencated')
    this.status = UnauthencatedException.status
    this.code = UnauthencatedException.code
  }
}
