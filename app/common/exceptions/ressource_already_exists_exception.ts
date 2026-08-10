import { PlatformLang } from '#common/services/http_service'
import { Exception } from '@adonisjs/core/exceptions'

export class RessourceAlreadyExistsException extends Exception {
  static status = 404
  static code = 'E_Already_EXISTS'

  constructor(
    lang: PlatformLang,
    ressourceLabel?: string,
    pressourceID?: number | string,
    message?: string
  ) {
    // super(option?.message ?? `${option?.ressourceLabel ?? 'Ressource'} already exists ${option?.pressourceID ? 'with identifier ' + option?.pressourceID : ''}`)
    super(message ?? e_message(lang, ressourceLabel, pressourceID))

    if (ressourceLabel) {
      this.code = RessourceAlreadyExistsException.code.replace(
        'E_',
        `E_${(ressourceLabel ?? '').toUpperCase()}_`
      )
    }

    this.status = RessourceAlreadyExistsException.status
  }
}

export type RessourceAlreadyExistsExceptionOptions = {}

function e_message(lang: PlatformLang, ressourceLabel?: string, pressourceID?: string | number) {
  let message = ressourceLabel ?? ''

  switch (lang) {
    case PlatformLang.fr:
      message =
        (message ?? 'La ressource') +
        ' existe déjà' +
        (ressourceLabel ? ` avec l'identifiant ${pressourceID}` : '')
      break

    default:
      message =
        (message ?? 'Ressource') +
        ' already exists' +
        (ressourceLabel ? ` with identifier ${pressourceID}` : '')
      break
  }

  return message
}
