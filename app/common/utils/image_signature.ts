import { open } from 'node:fs/promises'

/**
 * **Reconnaître une image à ses octets, pas à son nom.**
 *
 * Une extension et un `Content-Type` sont deux affirmations du client : `payload.php` renommé
 * `photo.jpg` reste du PHP, et un `Content-Type: image/png` posé à la main ne change rien au
 * contenu. Le seul témoignage qui ne vient pas du client, c'est le début du fichier lui-même — sa
 * **signature** (« magic number »), écrite par l'encodeur.
 *
 * C'est ce que ce module lit, et c'est de sa réponse que dépendent **deux** décisions : accepter ou
 * refuser le dépôt, et choisir l'extension du fichier écrit sur le disque. Aucune des deux ne
 * consulte le nom fourni par le client (`ImageStore`).
 *
 * ## Trois formats, et pas un de plus
 *
 * JPEG, PNG et WebP : exactement ce que le recadrage du navigateur peut produire (`canvas.toBlob`)
 * et ce que `Image.network` sait décoder côté Flutter. Un GIF animé ou un SVG n'ont rien à faire
 * dans une tuile d'accueil — et le SVG, en particulier, est un document exécutable qu'on ne sert
 * pas depuis un dossier public.
 *
 * ## Pourquoi pas la détection de `MultipartFile`
 *
 * AdonisJS sniffe déjà les octets (`file-type`) pour peupler `file.type`/`file.subtype` — mais il
 * **retombe sur le nom et l'en-tête** quand la détection échoue (`part_handler`), ce qui rouvre
 * exactement la porte qu'on veut fermer. Ici, l'absence de signature connue est un refus, jamais un
 * repli.
 */

/** Les formats acceptés — et l'extension que le fichier portera sur le disque. */
export const IMAGE_FORMATS = {
  jpeg: { extension: 'jpg', mimeType: 'image/jpeg' },
  png: { extension: 'png', mimeType: 'image/png' },
  webp: { extension: 'webp', mimeType: 'image/webp' },
} as const

export type ImageFormat = keyof typeof IMAGE_FORMATS

/** Assez d'octets pour trancher les trois formats (WebP demande les octets 8 à 11). */
const HEADER_BYTES = 12

/**
 * La signature d'une image, ou `null` si les premiers octets n'en désignent aucune.
 *
 * Ne lit que les 12 premiers octets : décoder l'image entière pour savoir si c'en est une
 * coûterait un décodeur (et sa surface d'attaque) pour une réponse que l'en-tête donne déjà.
 */
export function imageFormatOf(header: Uint8Array): ImageFormat | null {
  if (header.length < HEADER_BYTES) return null

  // JPEG — `FF D8 FF`, le marqueur SOI suivi du premier marqueur de segment.
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'jpeg'

  // PNG — `89 P N G \r \n 1A \n`, la signature en huit octets de la RFC 2083.
  if (
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return 'png'
  }

  // WebP — conteneur RIFF : `R I F F` … (taille) … `W E B P`.
  if (
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return 'webp'
  }

  return null
}

/**
 * Le format d'un fichier **sur le disque**, ou `null` s'il n'est pas une image reconnue.
 *
 * Un fichier illisible ou trop court donne `null` — un refus, pas une exception : à cet endroit,
 * « je n'ai pas pu vérifier » et « ce n'est pas une image » doivent produire la même décision.
 */
export async function imageFormatOfFile(path: string): Promise<ImageFormat | null> {
  let handle
  try {
    handle = await open(path, 'r')
    const header = new Uint8Array(HEADER_BYTES)
    const { bytesRead } = await handle.read(header, 0, HEADER_BYTES, 0)
    return imageFormatOf(header.subarray(0, bytesRead))
  } catch {
    return null
  } finally {
    await handle?.close()
  }
}
