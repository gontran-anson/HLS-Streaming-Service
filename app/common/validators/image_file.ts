import { IMAGE_FORMATS, imageFormatOfFile } from '#common/utils/image_signature'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type { FieldContext } from '@vinejs/vine/types'
import vine from '@vinejs/vine'

/**
 * **Un fichier image, vérifié à ses octets** — la règle VineJS que tout dépôt d'image du dépôt
 * utilise (PRD refonte-back-office §5 quater).
 *
 * `vine.file({ extnames })` compare `file.extname`, qu'AdonisJS dérive du contenu **quand il y
 * parvient** et, sinon, du nom du fichier et de l'en-tête `Content-Type` (`part_handler`). Ce repli
 * est raisonnable pour un `.docx` ; il ne l'est pas ici, où le fichier accepté finira **écrit dans
 * un dossier servi publiquement**. La règle ci-dessous ferme ce repli : pas de signature JPEG, PNG
 * ou WebP en tête de fichier ⇒ refus, quoi qu'annoncent le nom et l'en-tête.
 *
 * Elle **complète** `vine.file()`, elle ne le remplace pas : la borne de taille reste celle du
 * schéma, et c'est elle qui coupe le flux avant que le disque ne se remplisse.
 *
 * Le message est rendu par le `messagesProvider` du controller, comme tous les autres — la clé est
 * `<champ>.image`.
 */
const isImageFile = vine.createRule(
  async (value: unknown, _options: undefined, field: FieldContext) => {
    // `vine.file()` a déjà refusé ce qui n'est pas un fichier : rien à ajouter ici.
    const file = value as MultipartFile
    if (!file?.tmpPath) return

    if ((await imageFormatOfFile(file.tmpPath)) === null) {
      field.report('The {{ field }} field must be a JPEG, PNG or WebP image', 'image', field)
    }
  },
  { isAsync: true, name: 'image' }
)

/** Les extensions annoncées au navigateur et à `vine.file()` — le contenu, lui, est re-vérifié. */
export const IMAGE_EXTNAMES = Object.values(IMAGE_FORMATS).map((format) => format.extension)

/**
 * `vine.file()` borné en taille **et** vérifié à la signature.
 *
 * `size` est en octets, comme partout ailleurs dans ce dépôt : une taille exprimée en `'2mb'` se
 * lit bien mais ne se compare pas à la borne que le navigateur applique de son côté.
 */
export const imageFile = (options: { size: number }) =>
  vine.file({ size: options.size, extnames: IMAGE_EXTNAMES }).use(isImageFile())
