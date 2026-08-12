# Sortie HLS audio uniquement — la vidéo n'est qu'un conteneur

Ce service produit **exclusivement** du HLS **audio** (AAC-LC). Les fichiers vidéo
(`.mp4`, `.mkv`, `.mov`…) sont acceptés par commodité, mais `ffmpeg` **jette la piste
vidéo** (`-vn`) et n'extrait que l'audio à la volée pendant la génération du HLS — aucune
passe d'extraction séparée pour fabriquer le HLS. C'est un service de diffusion audio
(enseignements parlés, louange).

> **Amendement du 2026-08-12 — « permanente » était trop fort.** Cet ADR disait « on ne
> produira **jamais** de HLS vidéo » ; l'appelant (`new-life-server`) a explicitement retenu
> **l'audio aujourd'hui, la vidéo plus tard**. La frontière est donc **actuelle**, pas
> définitive : elle tient tant que la bande passante togolaise commande, et l'échelle de
> rendus est le seul endroit à rouvrir le jour venu — HLS sait porter des variantes vidéo
> **et** une variante audio dans un même `master.m3u8`, donc l'URL publiée n'aura pas besoin
> d'un jumeau.
>
> **Ce qui décide si le fonds déjà transcodé sera ré-encodable, ce n'est pas cet ADR, c'est
> le chemin d'ingestion** ([ADR-0007](0007-url-ingestion-the-source-stays-with-the-caller.md)) :
> par **upload**, la piste vidéo est perdue pour toujours (archive FLAC, Source détruite) ;
> par **URL**, elle survit dans l'objet de l'appelant — s'il le conserve.

## Consequences

- Un fichier vidéo **sans piste audio** est un échec métier légitime (voir cycle de vie
  FAILED), détecté par `ffprobe` dans le worker, pas à l'upload.
- L'artefact d'archive n'est pas la vidéo mais l'audio extrait sans perte (voir ADR-0004).
