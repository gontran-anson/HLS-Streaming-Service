import { PlatformLang } from '#common/services/http_service'
import { Exception } from '@adonisjs/core/exceptions'

export class RessourceNotExistsException extends Exception {
  static status = 404
  static code = 'E_NOT_EXISTS'

  constructor(
    lang: PlatformLang,
    ressourceLabel?: string,
    pressourceID?: number | string,
    message?: string
  ) {
    super(message ?? e_message(lang, ressourceLabel, pressourceID))
    if (ressourceLabel)
      this.code = RessourceNotExistsException.code.replace(
        'E_',
        `E_${ressourceLabel.toUpperCase()}_`
      )
    this.status = RessourceNotExistsException.status
  }
}

function e_message(lang: PlatformLang, ressourceLabel?: string, pressourceID?: string | number) {
  let message = ressourceLabel ?? ''

  switch (lang) {
    case PlatformLang.fr:
      message =
        (message ?? 'La ressource') +
        " n'existe pas" +
        (pressourceID ? ` avec l'identifiant ${pressourceID}` : '')
      break

    default:
      message =
        (message ?? 'Ressource') +
        ' not exists' +
        (pressourceID ? ` with identifier ${pressourceID}` : '')
      break
  }

  return message
}
