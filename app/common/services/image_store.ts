import { IMAGE_FORMATS, imageFormatOfFile } from '#common/utils/image_signature'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import app from '@adonisjs/core/services/app'
import { randomUUID } from 'node:crypto'

/**
 * **Le stockage d'images du dépôt** — réception, vérification, écriture, URL rendue.
 *
 * ## Pourquoi le dossier public, et pourquoi c'est légitime
 *
 * L'ADR-0005 écarte le service des **octets de segments vidéo** : plusieurs gigaoctets par culte,
 * un débit soutenu, un transcodage — tout cela appartient au module de diffusion externe. Une photo
 * de tuile pèse quelques dizaines de kilo-octets et se sert une fois, avec un `ETag`. Rien dans
 * l'ADR ne s'y oppose, et le PRD §5 quater le dit explicitement.
 *
 * Les fichiers vont donc dans `public/uploads/<dossier>/` — le répertoire qu'`@adonisjs/static`
 * sert déjà (`app.publicPath()`, cf. `config/static.ts` et `static_provider`), avec `etag` et
 * `lastModified` actifs. Aucune dépendance nouvelle : `@adonisjs/drive` apporterait une abstraction
 * de pilotes (S3, GCS…) dont ce lot n'a aucun usage, et l'installer « au cas où » ferait porter à
 * la production une brique que personne n'aurait configurée.
 *
 * `public/uploads` est **ignoré par git** : c'est du contenu déposé par des administrateurs, pas du
 * code. Le dossier est créé à la volée (`mkdir -p` implicite de `MultipartFile.move`).
 *
 * ## Deux règles de sûreté, et elles ne sont pas négociables
 *
 * **1. Le nom fourni par le client n'atteint jamais le disque.** Ni tel quel, ni « assaini » : le
 * nom écrit est un UUID v4 tiré ici, suivi de l'extension **déduite des octets**. Une tentative de
 * traversée (`../../.env`) ne trouve donc rien à traverser — il n'y a pas de chemin à échapper,
 * parce qu'aucun morceau du nom client n'entre dans la composition. C'est plus fort qu'un filtre :
 * un filtre se contourne, une valeur ignorée ne se contourne pas.
 *
 * **2. Un fichier accepté est une image réelle.** La signature est relue ici — et pas seulement
 * dans le validateur — parce que c'est *ici* que l'extension du fichier écrit est choisie. Faire
 * dériver cette extension d'autre chose que du contenu réel reviendrait à laisser le client
 * décider du `Content-Type` que le serveur statique annoncera plus tard.
 *
 * L'URL rendue est **relative** (`/uploads/teachings/<uuid>.jpg`) : le portail et le mobile
 * atteignent l'API par des origines différentes (et par un nom d'hôte qui change entre
 * environnements), donc c'est au client de la résoudre contre sa propre base d'API.
 */

/** Le segment de premier niveau sous `public/` — un seul, pour que la règle .gitignore soit simple. */
const UPLOADS_ROOT = 'uploads'

/** Ce que la vérification a refusé. Le controller le traduit en message de formulaire. */
export class NotAnImageError extends Error {
  constructor() {
    super('The uploaded file is not a JPEG, PNG or WebP image')
  }
}

export class ImageStore {
  /**
   * Écrit le fichier et rend son URL publique.
   *
   * @param file Fichier reçu (`request.file(...)`), déjà borné en taille par le validateur.
   * @param folder Sous-dossier de rangement (`'teachings'`). **Constante du dépôt**, jamais une
   *   donnée de requête — c'est le seul segment de chemin qui ne vient pas d'un UUID.
   */
  async save(file: MultipartFile, folder: string): Promise<string> {
    if (!file.tmpPath) throw new NotAnImageError()

    // Relue ici : c'est cette lecture, et aucune autre, qui décide de l'extension écrite.
    const format = await imageFormatOfFile(file.tmpPath)
    if (format === null) throw new NotAnImageError()

    // Nom non devinable (122 bits d'aléa) — le nom client n'entre nulle part dans cette ligne.
    const fileName = `${randomUUID()}.${IMAGE_FORMATS[format].extension}`

    await file.move(app.publicPath(UPLOADS_ROOT, folder), { name: fileName })

    return `/${UPLOADS_ROOT}/${folder}/${fileName}`
  }
}
