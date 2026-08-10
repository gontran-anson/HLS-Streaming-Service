import { type PlatformLang } from '#common/services/http_service'
import { Exception } from '@adonisjs/core/exceptions'

export class BaseException extends Exception {
  constructor(protected options?: ExceptionOptions) {
    super(options?.message)
  }

  static status = 404
}

export type ExceptionOptions = {
  lang?: PlatformLang
  message?: string
}
