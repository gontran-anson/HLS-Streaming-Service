# RustFS est l'origine de diffusion ; disque applicatif borné ; pipeline en deux jobs idempotents

> **Amendé par [ADR-0007](0007-url-ingestion-the-source-stays-with-the-caller.md).** Le pipeline en
> deux temps décrit ici — encoder, puis archiver et récupérer le disque — ne vaut que pour le chemin
> **`POST /upload`**. Sur le chemin **`POST /transcodes`** (ingestion par URL), il n'y a ni copie
> locale de la Source, ni archive FLAC : ffmpeg lit l'URL, et le master reste l'objet de l'appelant.
> Tout le reste — RustFS comme origine de diffusion, disque borné, idempotence — s'applique aux deux.

Le HLS output est **servi depuis RustFS** via Caddy (RustFS est l'origine de diffusion,
pas seulement une archive). La copie HLS sur le disque applicatif n'est qu'un **staging
transitoire**, supprimée après le push vers RustFS. Ni la Source ni le HLS ne s'accumulent
localement : le disque applicatif reste **borné**.

Le traitement est découpé en **deux jobs BullMQ** :

1. **Transcodage + publication** — `ffmpeg` écrit HLS + FLAC en local, puis pousse le HLS
   vers RustFS ; le Transcode passe **COMPLETED** *après* confirmation du push (COMPLETED
   = « lisible via Caddy→RustFS »).
2. **Archivage + nettoyage** — pousse le FLAC (Archive audio) vers RustFS, puis supprime
   HLS local **et** Source locale une fois l'archive confirmée.

## Considered Options

- **Tout garder en local pour toujours** (« Caddy sert le local », comme le dit la spec
  d'origine) : croissance disque non bornée — rejeté.
- **Cache LRU local devant RustFS** : meilleur en latence mais plomberie Caddy la plus
  lourde — reporté.

## Consequences

- Le job de transcodage est **idempotent à point de reprise** : sur retry, il **saute
  `ffmpeg` si le HLS local existe déjà** et ne rejoue que le push. Une panne RustFS pendant
  la publication ne coûte donc **jamais** un re-transcodage (le CPU cher n'est dépensé
  qu'une fois). C'est pourquoi le nettoyage local est confié au job 2, pas au job 1.
- Ceci contredit délibérément la formulation « Caddy sert directement le local » de la
  spec initiale.
