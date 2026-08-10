import { SimpleMessagesProvider } from '@vinejs/vine'
import { CONTENT_LOCALES, pickTranslation, type ContentLocale } from '#common/utils/localized_text'

/**
 * Un message de validation, traduit langue par langue.
 *
 * Les clés sont **celles de la plateforme** (`CONTENT_LOCALES`, issue #111) : le type se dérive de
 * l'unique liste plutôt que de les énumérer. Il portait auparavant `es` et `de`, deux langues que
 * pas un message du dépôt n'a jamais servies.
 *
 * **`default` est requis** : c'est le texte d'une langue hors bornes — et, en pratique, l'anglais.
 * Un appelant qui écrit `{ fr, default }` sert donc `fr` en français, `default` en anglais, et
 * `fr` en éwé (repli `ee → fr`, cf. `LOCALE_FALLBACKS`).
 */
export type MultiLangMessage = Partial<Record<ContentLocale, string>> & { default: string }

/**
 * Le champ **tel que l'admin le voit dans le formulaire**, dans les deux langues du portail :
 * `fr` porte l'article et la majuscule (« Le titre », « La description ») parce qu'il ouvre la
 * phrase ; `en` reste nu (« title ») parce qu'il s'insère après « The ».
 */
export type FieldLabel = { fr: string; en: string }

/** Comment nommer une langue de contenu **dans** un message, côté `fr` et côté `en`. */
const CONTENT_LOCALE_NAMES: Record<ContentLocale, { fr: string; en: string }> = {
  fr: { fr: 'en français', en: 'French' },
  en: { fr: 'en anglais', en: 'English' },
  ee: { fr: 'en éwé', en: 'Ewe' },
}

export class ValidatorMessages {
  /**
   * Le repli entre langues n'est pas décidé ici : `pickTranslation` porte la chaîne unique de la
   * plateforme (`ee → fr`). `default` est le terminus propre à cette famille de cartes.
   */
  private static getMessage(lang: string, message: string | MultiLangMessage): string {
    if (typeof message === 'string') return message
    return pickTranslation(message, lang, message.default)
  }

  /**
   * Messages d'un champ validé par `localizedText()` (`#common/validators/localized_text`,
   * ADR-0023) — issue #78.
   *
   * Une carte de traduction n'est pas un champ : c'est **trois sous-champs**, et VineJS nomme ses
   * erreurs d'après la clé finale (`title.fr`, `title.en`…). Sans override, un `fr` manquant
   * remonte « The fr field must be defined » — l'anglais générique, et le mot « fr » à la place du
   * nom du champ, y compris pour un admin en français. Le motif étant strictement le même sur les
   * cinq controllers du calendrier, il est produit ici plutôt que recopié.
   *
   * Seuls `fr` et `default` sont écrits : `resolveAdminLocale` ne rend que `fr` ou `en`, et une
   * demande en `ee` replie sur `fr` (`LOCALE_FALLBACKS`, issue #111). Aucune autre clé n'aurait
   * de lecteur.
   *
   * Les messages du **français** ne se qualifient pas (« Le titre ne peut pas être vide ») : `fr`
   * est la cible du repli, donc *le* champ. `en` et `ee` sont des traductions, et se nomment comme
   * telles (« Le titre en anglais… »), sans quoi l'admin ne saurait pas laquelle corriger.
   *
   * `maxLength` n'est déclaré que si l'appelant en pose une — sinon la clé pointerait une règle
   * qui n'existe pas sur ce champ.
   *
   * ⚠️ Sur HTTP, `minLength` ne se déclenche **pas** : le bodyparser rogne les chaînes du corps
   * JSON et remplace les blanches par `null` (`convertEmptyStringsToNull`, `config/bodyparser.ts`),
   * si bien qu'un `fr` vide arrive en `required` et qu'une traduction facultative vide est
   * simplement effacée. Les clés `minLength` restent servies pour les validations qui ne passent
   * pas par cette frontière — et pour le jour où la normalisation changerait.
   */
  static localizedTextMessages(
    field: string,
    label: FieldLabel,
    options: { maxLength?: number } = {}
  ): Record<string, MultiLangMessage> {
    const messages: Record<string, MultiLangMessage> = {
      // Un objet est attendu, pas une chaîne : sans ça le refus se lit « must be an object ».
      [`${field}.object`]: {
        fr: `${label.fr} doit être renseigné langue par langue`,
        default: `The ${label.en} must be provided language by language`,
      },
      // `fr` est requis : c'est la cible du repli de `pickLocalized`.
      [`${field}.fr.required`]: {
        fr: `${label.fr} en français est obligatoire`,
        default: `The French ${label.en} is required`,
      },
    }

    for (const locale of CONTENT_LOCALES) {
      const name = CONTENT_LOCALE_NAMES[locale]
      const inFr = locale === 'fr' ? label.fr : `${label.fr} ${name.fr}`
      const inEn = locale === 'fr' ? `The ${label.en}` : `The ${name.en} ${label.en}`

      // `trim()` puis `minLength(1)` — atteignable hors HTTP seulement, cf. l'avertissement plus haut.
      messages[`${field}.${locale}.minLength`] = {
        fr: `${inFr} ne peut pas être vide`,
        default: `${inEn} cannot be empty`,
      }

      if (options.maxLength !== undefined) {
        messages[`${field}.${locale}.maxLength`] = {
          fr: `${inFr} ne peut pas dépasser ${options.maxLength} caractères`,
          default: `${inEn} cannot exceed ${options.maxLength} characters`,
        }
      }
    }

    return messages
  }

  static getProvider(
    lang: string,
    customMessages: Record<string, string | MultiLangMessage> = {}
  ): SimpleMessagesProvider {
    const baseMessages = {
      'required': {
        fr: 'Le champ {{ field }} est requis',
        default: '{{ field }} field is required.',
      },
      'string': {
        fr: 'Le champ {{ field }} doit être une chaîne',
        default: '{{ field }} must be a string.',
      },
      'number': {
        fr: 'Le champ {{ field }} doit être un nombre',
        default: '{{ field }} must be a number.',
      },
      'email': {
        fr: 'Le champ {{ field }} doit être un email valide',
        default: '{{ field }} must be a valid email.',
      },
      'uuid': {
        fr: 'Le champ {{ field }} doit être un UUID valide',
        default: '{{ field }} must be a valid UUID.',
      },
      'exists': {
        fr: "La valeur sélectionnée pour {{ field }} n'existe pas",
        default: 'The selected {{ field }} does not exist.',
      },
      'unique': {
        fr: 'La valeur du champ {{ field }} existe déjà',
        default: '{{ field }} already exists.',
      },
      'min': {
        fr: 'Le champ {{ field }} doit avoir au moins {{ min }} caractères',
        default: '{{ field }} must be at least {{ min }} characters.',
      },
      'max': {
        fr: 'Le champ {{ field }} ne peut pas dépasser {{ max }} caractères',
        default: '{{ field }} cannot exceed {{ max }} characters.',
      },
      'positive': {
        fr: 'Le champ {{ field }} doit être positif',
        default: '{{ field }} must be positive.',
      },
      'database.exists': {
        fr: "Ce {{ field }} n'existe pas",
        default: 'The {{ field }} does not exist',
      },
      'database.unique': {
        fr: 'Ce {{ field }} existe déjà',
        default: 'This {{ field }} code already exists',
      },
      /**
       * Règles `normalizedEmail` / `normalizedPhone` / `normalizedIdentifier`
       * (`#common/utils/identifier_rules`) : utilisées par toutes les surfaces qui reçoivent un
       * identifiant (OTP, création de compte admin), donc déclarées ici plutôt que répétées en
       * override par champ.
       */
      'normalizedEmail': {
        fr: "L'adresse email n'est pas valide",
        default: 'The email address is not valid.',
      },
      'normalizedPhone': {
        fr: "Le numéro de téléphone n'est pas valide",
        default: 'The phone number is not valid.',
      },
      'withoutDecimals': {
        fr: 'Le champ {{ field }} ne peut pas avoir de décimales',
        default: '{{ field }} cannot have decimals.',
      },
    }

    const resolvedMessages: Record<string, string> = {}

    // Résoudre les messages de base
    for (const [key, message] of Object.entries(baseMessages)) {
      resolvedMessages[key] = this.getMessage(lang, message)
    }

    // Résoudre les messages personnalisés
    for (const [key, message] of Object.entries(customMessages)) {
      resolvedMessages[key] = this.getMessage(lang, message)
    }

    return new SimpleMessagesProvider(resolvedMessages)
  }
}
