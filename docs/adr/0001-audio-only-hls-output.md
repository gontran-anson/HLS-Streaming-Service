# Sortie HLS audio uniquement — la vidéo n'est qu'un conteneur

Ce service produit **exclusivement** du HLS **audio** (AAC-LC). Les fichiers vidéo
(`.mp4`, `.mkv`, `.mov`…) sont acceptés par commodité, mais `ffmpeg` **jette la piste
vidéo** (`-vn`) et n'extrait que l'audio à la volée pendant la génération du HLS — aucune
passe d'extraction séparée pour fabriquer le HLS. On ne produira jamais de HLS vidéo :
c'est un service de diffusion audio (enseignements parlés, louange), et cette frontière
est permanente.

## Consequences

- Un fichier vidéo **sans piste audio** est un échec métier légitime (voir cycle de vie
  FAILED), détecté par `ffprobe` dans le worker, pas à l'upload.
- L'artefact d'archive n'est pas la vidéo mais l'audio extrait sans perte (voir ADR-0004).
