/**
 * **Les langues de la plateforme, et le repli entre elles** (ADR-0023, issue #111).
 *
 * ## Une seule liste
 *
 * Ce fichier porte **l'unique** énumération des langues du système. `PlatformLang`
 * (`#common/services/http_service`) — les langues d'interface serveur : messages d'erreur,
 * validation, rendu — n'est plus une liste concurrente mais un **objet dérivé** de
 * `CONTENT_LOCALES`, construit à partir d'elle à l'exécution. Ajouter une langue ici l'ajoute
 * partout ; il n'existe plus d'endroit où en oublier une.
 *
 * Avant #111, deux listes coexistaient : `PlatformLang` valait `en | fr | es` et `CONTENT_LOCALES`
 * `fr | en | ee`. L'espagnol était déclaré mais **aucun message du dépôt ne l'a jamais traduit**
 * (zéro clé `es:`), tandis que l'éwé — la langue qui compte pour une église togolaise, `app_ee.arb`
 * côté mobile — était absent de l'interface. Chaque nouveau code devait choisir sa liste, et se
 * tromper ne produisait aucune erreur. L'espagnol a donc été retiré, l'éwé ajouté, et les deux
 * listes fondues en une.
 *
 * ## Deux formes de traduction, un seul repli
 *
 * Le **contenu** administrable (titre d'événement, libellé de catégorie…) est stocké en `jsonb`
 * sous forme de carte de traduction, et non en colonnes par langue (qui excluraient l'éwé et
 * imposeraient une migration par langue ajoutée) ni en table de traduction (qui obligerait à
 * modifier le contrat de synchro, ADR-0017). Le serveur envoie la **carte complète** ; le client
 * choisit sa langue et replie.
 *
 * Les **messages du serveur** (exceptions de domaine, validation) sont des cartes écrites en dur
 * dans le code, `{ en, fr }`, et c'est le serveur qui les replie.
 *
 * Les deux cas posent la même question — « la langue demandée n'a pas de traduction, où regarder
 * ensuite ? » — et reçoivent ici la même réponse : `pickTranslation` / `LOCALE_FALLBACKS`. Jamais
 * de `?? title['fr']` disséminé dans les transformers, jamais de `lang === 'fr' ? fr : en` recopié
 * dans une exception.
 */

/**
 * **Les langues de la plateforme** : celles du mobile (`fr`, `en`, `ee` — éwé), et depuis #111
 * celles de l'interface serveur. `fr` est en tête parce que c'est la cible du repli.
 */
export const CONTENT_LOCALES = ['fr', 'en', 'ee'] as const

export type ContentLocale = (typeof CONTENT_LOCALES)[number]

/**
 * Carte de traduction d'un champ de contenu. **`fr` est requis** : bloquer un administrateur
 * pressé sur une traduction qu'il ne fera pas produit des titres anglais bâclés — le repli est
 * plus honnête que le remplissage.
 */
export type LocalizedText = { fr: string } & Partial<Record<ContentLocale, string>>

/**
 * **Le repli de la plateforme, déclaré une fois.** Pour chaque langue, l'ordre dans lequel
 * consulter une carte de traductions.
 *
 * - `fr` et `en` ne replient sur rien : ce sont les deux langues qu'on écrit vraiment. Ce qui leur
 *   manque manque *pour de bon*, et l'appelant tranche avec son propre défaut (cf.
 *   `pickTranslation`).
 * - **`ee` replie sur `fr`.** L'éwé est partiel des deux côtés : `app_ee.arb` est incomplet et
 *   replie déjà sur le français côté mobile, et les centaines de messages `{ en, fr }` du serveur
 *   n'ont pas de version éwé. Exiger une traduction éwé pour chaque message reviendrait à en
 *   inventer que personne dans l'équipe ne relit — un texte faux est pire qu'un repli. Le repli
 *   est donc `fr`, **pas** `en` : c'est la langue de repli du projet, celle du mobile, et celle
 *   d'un lecteur éwéphone togolais.
 *
 * Une langue **inconnue** (`es`, `de`, un `Accept-Language` exotique) n'a pas d'entrée : elle
 * tombe directement sur le défaut de l'appelant.
 */
const LOCALE_FALLBACKS: Record<ContentLocale, readonly ContentLocale[]> = {
  fr: ['fr'],
  en: ['en'],
  ee: ['ee', 'fr'],
}

/**
 * Choisit la traduction d'une carte pour la langue demandée, en suivant `LOCALE_FALLBACKS`.
 *
 * `locale` accepte n'importe quelle chaîne (une `PlatformLang` comme un `Accept-Language` brut) :
 * une langue hors bornes retombe sur `fallback`.
 *
 * `fallback` est **la traduction dont l'appelant garantit l'existence**, et elle diffère selon la
 * carte : `fr` pour un contenu (requis par `LocalizedText`), l'anglais ou `default` pour un
 * message serveur. C'est le seul point où les deux familles divergent — la chaîne de repli, elle,
 * est commune.
 *
 * Une traduction présente mais **vide** compte comme absente : un `??` naïf rendrait la chaîne
 * vide, donc un titre invisible dans l'app.
 */
export function pickTranslation<T>(
  translations: Partial<Record<ContentLocale, T>>,
  locale: string,
  fallback: T
): T {
  const chain = LOCALE_FALLBACKS[locale as ContentLocale] ?? []

  for (const candidate of chain) {
    const value = translations[candidate]
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.length === 0) continue
    return value
  }

  return fallback
}

/**
 * Repli **unique** du contenu : langue demandée → sa chaîne de repli → `fr`.
 *
 * Reste l'entrée nommée du chemin de lecture (transformers, notifications) ; la règle vit dans
 * `pickTranslation`.
 */
export function pickLocalized(map: LocalizedText, locale: string): string {
  return pickTranslation(map, locale, map.fr)
}
