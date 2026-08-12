# Ingestion par URL — la Source reste chez l'appelant, et il n'y a pas d'archive

> Cet ADR **documente après coup** un comportement déjà livré (`POST /transcodes`, commit `f829bcd`)
> et **amende [ADR-0004](0004-rustfs-serving-origin-idempotent-pipeline.md)**, dont le pipeline en
> deux temps — encoder, puis archiver et récupérer le disque — ne décrit que le chemin par upload.

Le service a **deux** points d'entrée, et ils n'offrent **pas les mêmes garanties d'archivage** :

| | `POST /upload` (multipart) | `POST /transcodes` (URL) |
|---|---|---|
| Copie locale de la Source | oui, sur disque | **aucune** — ffmpeg lit l'URL |
| Archive audio | **FLAC** poussé dans RustFS | **aucune** |
| Master de conservation | l'archive FLAC | **l'objet de l'appelant** |
| Sort de la Source | **détruite** à l'archivage | intacte, hors du service |

Dans les deux cas, tout le reste est identique : même `id` UUID v7 (ADR-0002), même cycle
`PENDING → PROCESSING → COMPLETED | FAILED`, même HLS dans RustFS, même contrat unifié, mêmes
notifications (ADR-0005).

## Pourquoi cette asymétrie est délibérée

Elle découle d'une seule idée : **ne pas re-stocker ce que quelqu'un stocke déjà**. Un appelant qui
fournit une URL détient l'objet — le recopier ferait du service le second propriétaire d'un fichier
dont il n'est pas responsable, doublerait la facture de stockage, et créerait deux copies qui
divergeront le jour où l'une est supprimée.

Le corollaire est plus important que la décision elle-même : sur ce chemin, **l'archive de
conservation n'est pas notre affaire, elle est celle de l'appelant**. Le service ne garantit que le
HLS. Un appelant qui supprime son objet après transcodage perd la possibilité de ré-encoder — et
personne ici ne pourra le lui rendre.

## Ce que ça décide, sans en avoir l'air

Le service est **audio seul** (ADR-0001) : la piste vidéo d'un conteneur est jetée. Sur le chemin
**upload**, elle l'est **définitivement** — le FLAC ne contient que le son, et la Source est détruite.
Sur le chemin **URL**, elle survit dans l'objet de l'appelant.

Autrement dit, c'est ce choix d'ingestion, et non l'échelle de rendus, qui décide si un fonds
déjà transcodé pourra un jour être **ré-encodé en vidéo**. C'est trop lourd pour rester dans un
commentaire de controller.

## Considered Options

- **Télécharger la Source puis suivre le pipeline d'upload** (copie locale + archive FLAC) : rejeté —
  double le stockage, allonge le temps avant le premier octet encodé, et fait du service le
  propriétaire d'un fichier qu'il n'a pas reçu.
- **Rendre l'archivage optionnel par paramètre** : rejeté pour l'instant — un drapeau de plus sur un
  chemin qui n'a qu'un appelant, alors que la règle « qui fournit l'URL détient le master » est plus
  simple à retenir qu'un booléen.
- **N'exposer que l'ingestion par URL** et retirer l'upload : rejeté — l'upload reste le chemin le
  plus court pour une reprise en main manuelle, et c'est un contrat déjà documenté.

## Consequences

- **L'URL doit rester lisible pendant tout l'encodage**, pas seulement à l'acceptation : ffmpeg la lit
  de bout en bout. Une URL présignée à courte durée produirait des échecs dépendants de la charge de
  la file — le job peut démarrer longtemps après avoir été enfilé.
- **Le service enregistre l'URL comme master.** Si elle expire, le pointeur devient mort ; l'objet, lui,
  ne l'est pas. Le master réel est la **clé** détenue par l'appelant, pas l'URL signée qu'il a émise.
- **Aucune archive n'est produite**, donc `DELETE` sur un transcode ingéré par URL ne détruit que le
  HLS — il n'y a rien d'autre à détruire ici.
- **`originalFilename` est dérivé du dernier segment de l'URL**, pour l'affichage seulement. Ce n'est
  pas une donnée de confiance.
