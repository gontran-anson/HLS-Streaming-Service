import { Exception } from '@adonisjs/core/exceptions'
import { PlatformLang } from '#common/services/http_service'
import { pickTranslation } from '#common/utils/localized_text'

/**
 * Les traductions d'un message de domaine. **`en` et `fr` sont requis** : ce sont les deux langues
 * que le dépôt écrit réellement.
 *
 * `ee` est **facultatif** (issue #111). L'éwé est une langue de la plateforme, mais exiger une
 * version éwé des centaines de messages existants reviendrait à en inventer que personne dans
 * l'équipe ne relit — un texte faux est pire qu'un repli. Sans clé `ee`, le message est rendu en
 * **français** (cf. `LOCALE_FALLBACKS`), comme `app_ee.arb` replie côté mobile.
 */
export interface ExceptionMessage {
  en: string
  fr: string
  ee?: string
}

export interface ExceptionContext {
  [key: string]: string | number
}

export abstract class I18nException extends Exception {
  abstract get messages(): ExceptionMessage
  protected context: ExceptionContext = {}

  constructor(
    protected lang: PlatformLang = PlatformLang.en,
    context?: ExceptionContext
  ) {
    super()
    if (context) this.context = context
    this.message = this.getLocalizedMessage()
  }

  /**
   * Le repli n'est pas décidé ici : `pickTranslation` porte la chaîne de la plateforme
   * (`ee → fr`, `fr`/`en` sans repli), la même que celle du contenu. L'anglais est le **défaut de
   * cette famille de cartes** — celui d'une langue hors bornes, `es` compris — parce que `en` est
   * la seule clé dont `ExceptionMessage` garantit la présence à côté de `fr`.
   */
  private getLocalizedMessage(): string {
    const template = pickTranslation(this.messages, this.lang, this.messages.en)
    return this.interpolateMessage(template)
  }

  private interpolateMessage(template: string): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return this.context[key]?.toString() || match
    })
  }
}
