import type { HttpContext } from '@adonisjs/core/http'
import { PlatformLang, isPlatformLang } from '#common/services/http_service'

/**
 * Résout la langue de la plateforme depuis l'en-tête `Accept-Language`. Porte d'entrée de l'**API
 * mobile** ; le portail admin, lui, lit la session (`resolveAdminLocale`). Il n'existe pas (encore)
 * de middleware de langue global.
 *
 * Le jeu reconnu est **celui de `CONTENT_LOCALES`** et rien d'autre (issue #111) : `fr`, `en` et
 * — c'est le changement — `ee`. L'éwé n'est plus écrasé en anglais.
 *
 * ## Ce que devient `es`
 *
 * L'espagnol était accepté ici avant #111, mais **aucun message du dépôt n'avait de traduction
 * espagnole** : `PlatformLang.es` traversait le code pour retomber sur l'anglais au moment de
 * rendre le texte (`I18nException` : `lang === fr ? fr : en` ; `ValidatorMessages` : `default`).
 * `es` rejoint donc les langues inconnues et **replie sur `en`** — soit exactement le texte qu'un
 * client hispanophone recevait déjà. Le retrait de l'enum ne change aucune réponse observable.
 *
 * Le défaut reste `en` pour toute langue hors bornes (`de`, `pt`, en-tête absent) : c'est le sens
 * historique de cette fonction, et rien ne justifie de traiter `es` autrement que `de`. À ne pas
 * confondre avec le repli **entre traductions** (`LOCALE_FALLBACKS`, `#common/utils/localized_text`)
 * qui vise `fr` : ici on ne sait rien du lecteur, là on sait qu'il parle éwé.
 *
 * `slice(0, 2)` : on ne lit que la sous-balise de langue — `fr-FR` vaut `fr`. Les poids `q=` d'un
 * `Accept-Language` complet ne sont pas interprétés (le mobile envoie une langue simple).
 */
export function resolveLang(request: HttpContext['request']): PlatformLang {
  const raw = request.header('accept-language')?.slice(0, 2).toLowerCase()
  return isPlatformLang(raw) ? raw : PlatformLang.en
}
