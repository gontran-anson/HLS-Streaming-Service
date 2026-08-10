/**
 * **La convention `ILIKE` du serveur** (slice 7 — recherche globale ⌘K).
 *
 * Avant cette slice il n'existait **aucune** recherche texte dans le dépôt (zéro `ilike` /
 * `whereILike` dans les 111 actions). Ce fichier pose donc la règle une fois, pour que les onze
 * actions `Search*` — et toutes celles qui suivront — la partagent au lieu de la réinventer
 * chacune avec ses propres trous.
 *
 * ## Trois règles, et pourquoi
 *
 * 1. **On échappe les jokers `LIKE`.** `%` et `_` sont des métacaractères : `%` saisi tel quel
 *    devient « n'importe quoi », et une recherche sur `%` balaie la table entière en renvoyant
 *    tout. `\` est échappé en premier — c'est le caractère d'échappement par défaut de Postgres,
 *    l'oublier laisserait un `\%` saisi par l'utilisateur neutraliser l'échappement du `%` suivant.
 *    L'apostrophe, elle, n'a **rien** à voir avec `LIKE` : elle est portée par le *binding* de
 *    requête (jamais de concaténation SQL ici), donc rien à échapper — mais c'est précisément ce
 *    qu'un test doit démontrer.
 *
 * 2. **On borne la longueur.** Une saisie de 10 000 caractères ne trouvera rien mais fera quand
 *    même le parcours ; le motif est tronqué à `MAX_TERM_LENGTH`.
 *
 * 3. **On refuse en dessous de deux caractères.** Un `%a%` sur dix tables est un balayage complet
 *    pour un résultat inutilisable. Le controller rejette la requête (422) **avant** d'atteindre
 *    la moindre action ; les actions revalident (`normalizeSearchTerm` → `null`) parce qu'une
 *    action reste appelable hors HTTP.
 *
 * ## Ce que cette convention ne fait PAS
 *
 * `ILIKE` est insensible à la **casse** (Postgres replie via la collation, y compris sur les
 * caractères accentués : `ÉVÉNEMENT` matche `événement`), mais **pas aux accents** : `evenement`
 * ne trouvera pas `événement`. Rendre la recherche insensible aux accents demanderait l'extension
 * `unaccent` et un index d'expression — hors périmètre de cette slice, et signalé comme tel.
 */

/** En deçà, on refuse plutôt que de balayer les tables. */
export const MIN_TERM_LENGTH = 2

/**
 * Au-delà, le motif est tronqué. Un titre d'annonce ou un nom de branche n'approche jamais cette
 * longueur : ce qui dépasse est du bruit (un copier-coller de paragraphe), pas une intention.
 */
export const MAX_TERM_LENGTH = 120

/**
 * Neutralise les métacaractères `LIKE`/`ILIKE` d'une saisie utilisateur. `\` d'abord, sans quoi
 * les échappements ajoutés ensuite seraient eux-mêmes ré-échappés.
 *
 * Postgres utilise `\` comme caractère d'échappement par défaut de `LIKE` : aucun `ESCAPE` explicite
 * n'est nécessaire, et la valeur voyage en *binding* (jamais concaténée dans le SQL).
 */
export function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Saisie brute → terme exploitable, ou `null` si la requête ne mérite pas d'atteindre la base
 * (vide, blancs seuls, moins de `MIN_TERM_LENGTH` caractères). Tronque au-delà de
 * `MAX_TERM_LENGTH`.
 */
export function normalizeSearchTerm(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (trimmed.length < MIN_TERM_LENGTH) return null

  return trimmed.slice(0, MAX_TERM_LENGTH)
}

/**
 * Terme normalisé → motif `ILIKE` « contient » (`%terme%`), jokers de l'utilisateur neutralisés.
 * Renvoie `null` pour une saisie qu'on refuse (cf. `normalizeSearchTerm`) : l'appelant s'arrête là
 * et ne requête rien.
 */
export function toContainsPattern(raw: string | null | undefined): string | null {
  const term = normalizeSearchTerm(raw)
  if (term === null) return null

  return `%${escapeLikePattern(term)}%`
}

/**
 * **Chercher dans un champ multilingue `jsonb`** (ADR-0023) — `events.title`, `events.body`,
 * `event_categories.label`, `event_series.*`.
 *
 * Ces colonnes sont des **cartes de traduction** (`{"fr": …, "en": …, "ee": …}`), pas des chaînes.
 * Trois façons de les interroger, deux mauvaises :
 *
 * - `title->>'fr' ILIKE ?` — ne cherche que le français. Un titre saisi en éwé devient introuvable,
 *   et la liste des langues serait figée dans dix actions au lieu de vivre dans `CONTENT_LOCALES`.
 * - `title::text ILIKE ?` — cherche aussi dans les **clés** et la ponctuation JSON : taper `fr`
 *   remonterait tout le contenu de la base.
 * - `jsonb_each_text` — déplie la carte en `(clé, valeur)` et ne teste que les **valeurs**. Traverse
 *   donc **toutes** les langues réellement présentes dans la ligne, sans en énumérer aucune.
 *
 * Renvoie le fragment SQL à passer à `whereRaw(fragment, [pattern])`. Le motif voyage en *binding* ;
 * `column` est un nom de colonne **littéral du code appelant** — ne jamais y injecter d'entrée
 * utilisateur.
 *
 * Une colonne `NULL` (ex. `events.body`) ne produit aucune ligne dans la sous-requête : l'`EXISTS`
 * est simplement faux, aucun garde-fou supplémentaire n'est nécessaire.
 */
export function localizedContainsSql(column: string): string {
  return `EXISTS (SELECT 1 FROM jsonb_each_text(${column}) AS translation(locale, value) WHERE translation.value ILIKE ?)`
}
