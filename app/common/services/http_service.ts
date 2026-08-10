import { CONTENT_LOCALES, type ContentLocale } from '#common/utils/localized_text'

export class HttpService {
  private _lang: PlatformLang = PlatformLang.en

  get lang(): PlatformLang {
    return this._lang
  }

  set lang(lang: PlatformLang) {
    this._lang = lang
  }
}

/**
 * **Langue d'interface serveur** — messages d'erreur, validation, rendu (issue #111).
 *
 * ## Ce n'est plus une liste
 *
 * `PlatformLang` était un `enum` valant `en | fr | es`, face à `CONTENT_LOCALES` valant
 * `fr | en | ee` : **deux jeux de langues qui ne coïncidaient pas**, l'espagnol côté interface,
 * l'éwé côté contenu. Se tromper de jeu ne produisait aucune erreur — c'est ce qui a empêché
 * l'issue #89 de déduire `users.locale` depuis `Accept-Language`.
 *
 * L'espagnol était déclaré mais **jamais implémenté** : aucune clé `es:` nulle part dans `app/`.
 * Il a été retiré, l'éwé ajouté, et la liste supprimée : `PlatformLang` est désormais **construit
 * depuis `CONTENT_LOCALES`**, seule liste du dépôt. Il ne peut plus diverger — il n'a plus de
 * contenu propre à faire diverger.
 *
 * ## Pourquoi un objet figé et non un `enum`
 *
 * Un `enum` TypeScript ne se dérive pas d'un tuple : ses membres doivent être écrits à la main,
 * ce qui recréerait la seconde liste. L'objet ci-dessous se construit, lui, par
 * `CONTENT_LOCALES.map(...)`, tout en gardant **la forme que les appelants attendent** :
 * `PlatformLang.fr` reste une valeur, `PlatformLang` reste un type, les comparaisons
 * (`lang === PlatformLang.fr`), les clés calculées (`{ [PlatformLang.fr]: … }`) et les
 * `vine.enum([...])` sont inchangés. Seule différence pour un appelant : `PlatformLang.fr` n'est
 * plus utilisable **en position de type** (écrire `'fr'`, ou `Extract<PlatformLang, 'fr' | 'en'>`
 * comme le fait `AdminLocale`).
 *
 * Conséquence voulue : `PlatformLang` et `ContentLocale` sont **le même type**. Une langue de
 * requête est assignable à `users.locale` et réciproquement — c'est précisément ce que #111
 * cherchait à obtenir.
 */
export const PlatformLang = Object.freeze(
  Object.fromEntries(CONTENT_LOCALES.map((locale) => [locale, locale]))
) as { readonly [L in ContentLocale]: L }

export type PlatformLang = ContentLocale

/**
 * Une valeur quelconque est-elle une langue de la plateforme ? Porte d'entrée des chaînes non
 * typées : `Accept-Language`, locale de session, colonne lue en base.
 */
export function isPlatformLang(raw: unknown): raw is PlatformLang {
  return typeof raw === 'string' && (CONTENT_LOCALES as readonly string[]).includes(raw)
}
