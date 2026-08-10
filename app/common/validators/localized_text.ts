import vine from '@vinejs/vine'

/**
 * Règle VineJS réutilisable pour une **carte de traduction** de contenu (ADR-0023).
 *
 * Objet aux clés **bornées** à `{ fr, en, ee }` — une clé inconnue est rejetée plutôt que stockée
 * silencieusement dans le `jsonb`, où personne ne la retrouverait. **`fr` est requis et non vide**
 * (c'est la cible du repli) ; `en` et `ee` sont facultatives.
 *
 * `maxLength` est passé par l'appelant : un titre et un corps n'ont pas la même borne.
 */
export const localizedText = (options: { maxLength?: number } = {}) => {
  const text = () => {
    const rule = vine.string().trim().minLength(1)
    return options.maxLength ? rule.maxLength(options.maxLength) : rule
  }

  return vine.object({
    fr: text(),
    en: text().optional(),
    ee: text().optional(),
  })
}
