import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

/**
 * **Normalisation des identifiants — invariant serveur** (ADR-0020).
 *
 * `verify-code` crée le compte quand l'identifiant est inconnu : la moindre différence de
 * casse (`Ama@Example.com`) ou de format (`90 12 34 56`) produirait alors un **doublon de
 * personne**, dont les notes, prières et appartenances se répartissent entre deux identités,
 * sans aucun signal. Un client normalise pour l'ergonomie ; le serveur normalise parce qu'il
 * en dépend.
 *
 * Ces fonctions sont **pures** : elles ne touchent ni model ni base. Elles sont la source
 * unique de vérité, partagée par les trois verrous — la transformation VineJS
 * (`#common/utils/identifier_rules`), l'action `CreateAccount` (seul chemin de création d'un
 * `users`, ADR-0011/0012) et la migration de données.
 */

/**
 * Pays par défaut pour l'interprétation d'un numéro **national** (Togo). Un numéro déjà en
 * E.164 (`+228…`, `+33…`) est reconnu tel quel : ce défaut ne s'applique qu'en l'absence
 * d'indicatif.
 */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'TG'

export type IdentifierChannel = 'email' | 'phone'

/**
 * Canal porté par l'identifiant lui-même : un `@` ⇒ email, sinon téléphone.
 *
 * `POST /auth/verify-code` ne reçoit **pas** de `channel` (contrat mobile) — il le déduit.
 * Cette déduction doit donc être **la même** qu'à la demande de code : si `request-code`
 * rangeait `90 12 34 56` sous un canal et `verify-code` le cherchait sous un autre, le code
 * émis serait introuvable. D'où une fonction unique, appelée des deux côtés, plutôt que deux
 * conditions qui se ressemblent. C'est aussi la règle qu'applique le mobile pour basculer
 * entre ses deux champs de saisie.
 */
export function channelOf(identifier: string): IdentifierChannel {
  return identifier.includes('@') ? 'email' : 'phone'
}

/** `  Ama@Example.COM ` → `ama@example.com`. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * `90 12 34 56` / `+228 90 12 34 56` → `+22890123456` (E.164).
 *
 * Retourne `null` si le numéro est **invalide** (pas seulement mal formaté) : l'appelant
 * décide alors de la sanction — 422 côté validation, exception de domaine côté action. On
 * refuse **avant** tout envoi de code : une ligne parasite dans `otp_codes` et, quand le
 * canal téléphone sera facturé, un SMS envoyé dans le vide.
 */
export function normalizePhone(value: string): string | null {
  const parsed = parsePhoneNumberFromString(value.trim(), DEFAULT_PHONE_COUNTRY)
  if (!parsed || !parsed.isValid()) return null

  return parsed.number
}

/** Aiguille vers `normalizeEmail` / `normalizePhone` selon le canal. */
export function normalizeIdentifier(channel: IdentifierChannel, value: string): string | null {
  return channel === 'email' ? normalizeEmail(value) : normalizePhone(value)
}

export interface IdentifierCollision {
  /** Valeur normalisée revendiquée par plusieurs lignes. */
  normalized: string
  /** Valeurs brutes en conflit, telles que stockées. */
  values: string[]
}

/**
 * Détecte les lignes existantes qui **convergeraient** vers le même identifiant une fois
 * normalisées (`Ama@X.com` + `ama@x.com`). Utilisé par la migration de données : normaliser
 * en aveugle écraserait silencieusement l'une des deux identités — on préfère échouer
 * bruyamment et laisser un humain arbitrer.
 */
export function findIdentifierCollisions(
  rows: { value: string; normalized: string | null }[]
): IdentifierCollision[] {
  const groups = new Map<string, string[]>()

  for (const row of rows) {
    if (row.normalized === null) continue
    const bucket = groups.get(row.normalized)
    if (bucket) bucket.push(row.value)
    else groups.set(row.normalized, [row.value])
  }

  return [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([normalized, values]) => ({ normalized, values }))
}
