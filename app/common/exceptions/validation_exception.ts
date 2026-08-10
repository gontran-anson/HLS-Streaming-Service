import { I18nException } from '#common/exceptions/i18n_exception'
import { type PlatformLang } from '#common/services/http_service'

export class ValidationException extends I18nException {
  static status = 422
  static code = 'E_VALIDATION_ERROR'

  get messages() {
    return {
      en: 'Validation failed{{field}}',
      fr: 'Échec de la validation{{field}}',
    }
  }

  constructor(lang: PlatformLang, field?: string, customMessage?: string) {
    if (customMessage) {
      super(lang)
      this.message = customMessage
    } else {
      super(lang, field ? { field: ` for field: ${field}` } : {})
    }
  }
}

export class RequiredFieldException extends I18nException {
  static status = 422
  static code = 'E_REQUIRED_FIELD'

  get messages() {
    return {
      en: 'Field {{field}} is required',
      fr: 'Le champ {{field}} est requis',
    }
  }

  constructor(lang: PlatformLang, field: string) {
    super(lang, { field })
  }
}

export class InvalidFormatException extends I18nException {
  static status = 422
  static code = 'E_INVALID_FORMAT'

  get messages() {
    return {
      en: 'Invalid format for field {{field}}',
      fr: 'Format invalide pour le champ {{field}}',
    }
  }

  constructor(lang: PlatformLang, field: string) {
    super(lang, { field })
  }
}
