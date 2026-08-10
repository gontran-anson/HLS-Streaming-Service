import {
  channelOf,
  normalizeEmail,
  normalizePhone,
  type IdentifierChannel,
} from '#common/utils/identifier_normalizer'
import vine from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'

/**
 * **Premier des deux verrous de normalisation** (ADR-0020) : des règles VineJS réutilisables
 * qui réécrivent l'identifiant *dans la charge validée*, avant que le moindre code ne soit
 * émis. Le second verrou vit dans `CreateAccount` — une action qui garantit un invariant ne
 * doit pas dépendre de qui l'appelle.
 *
 * Usage : `vine.string().trim().maxLength(254).use(normalizedIdentifier())`.
 */

/** Noms de règle portés par les erreurs de format (clés de message i18n). */
const INVALID_PHONE_RULE = 'normalizedPhone'
const INVALID_EMAIL_RULE = 'normalizedEmail'

/** 422 avant tout envoi : pas de ligne `otp_codes`, pas de SMS ni d'email dans le vide. */
function reportInvalid(channel: IdentifierChannel, field: FieldContext): void {
  if (channel === 'email') {
    field.report('The {{ field }} is not a valid email address', INVALID_EMAIL_RULE, field)
  } else {
    field.report('The {{ field }} is not a valid phone number', INVALID_PHONE_RULE, field)
  }
}

/**
 * Email → minuscules, **après** contrôle de syntaxe. Le contrôle n'est pas cosmétique :
 * `verify-code` crée le compte quand l'identifiant est inconnu, donc `notanemail` produirait
 * une ligne `users` portant un email qui n'en est pas un — une identité sans porteur possible,
 * que rien ne peut plus joindre ni réclamer.
 */
function mutateToNormalizedEmail(value: string, field: FieldContext): void {
  const normalized = normalizeEmail(value)

  if (!vine.helpers.isEmail(normalized)) {
    reportInvalid('email', field)
    return
  }

  field.mutate(normalized, field)
}

function mutateToNormalizedPhone(value: string, field: FieldContext): void {
  const normalized = normalizePhone(value)

  if (normalized === null) {
    reportInvalid('phone', field)
    return
  }

  field.mutate(normalized, field)
}

/** Aiguille vers la normalisation du canal donné. */
function mutateToNormalized(channel: IdentifierChannel, value: string, field: FieldContext): void {
  if (channel === 'email') mutateToNormalizedEmail(value, field)
  else mutateToNormalizedPhone(value, field)
}

/** Email → `trim()` puis minuscules ; syntaxe invalide → erreur de validation. */
export const normalizedEmail = vine.createRule(
  (value: unknown, _options: undefined, field: FieldContext) => {
    if (typeof value !== 'string') return
    mutateToNormalizedEmail(value, field)
  }
)

/** Téléphone → E.164 (défaut `TG`) ; invalide → erreur de validation. */
export const normalizedPhone = vine.createRule(
  (value: unknown, _options: undefined, field: FieldContext) => {
    if (typeof value !== 'string') return
    mutateToNormalizedPhone(value, field)
  }
)

/**
 * Identifiant de `request-code`, qui reçoit un `channel` déclaré (`field.parent`).
 *
 * Le canal **réellement porté par la valeur** (`channelOf`) fait foi : c'est la seule
 * déduction que connaît `verify-code`, à qui le contrat mobile n'envoie pas de `channel`. Le
 * canal déclaré n'est donc qu'un recoupement — le croire sur parole ferait ranger un code
 * sous une forme que la vérification irait chercher sous une autre.
 *
 * Canal absent ou inconnu → on ne touche à rien : `vine.enum` signale déjà l'erreur sur
 * `channel`.
 */
export const normalizedIdentifier = vine.createRule(
  (value: unknown, _options: undefined, field: FieldContext) => {
    if (typeof value !== 'string') return

    const declared = (field.parent as Record<string, unknown> | undefined)?.channel as
      | IdentifierChannel
      | undefined

    if (declared !== 'email' && declared !== 'phone') return

    if (channelOf(value) !== declared) {
      reportInvalid(declared, field)
      return
    }

    mutateToNormalized(declared, value, field)
  }
)

/**
 * Identifiant **sans `channel` déclaré** (`verify-code`) : le canal se déduit de la valeur,
 * puis la normalisation est celle de `normalizedIdentifier` — même fonction de déduction,
 * même code de normalisation, donc aucune dérive possible entre les deux routes.
 */
export const inferredIdentifier = vine.createRule(
  (value: unknown, _options: undefined, field: FieldContext) => {
    if (typeof value !== 'string') return
    mutateToNormalized(channelOf(value), value, field)
  }
)
