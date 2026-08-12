# Streaming Service

Module de diffusion audio de New Life : reçoit un fichier source (audio ou vidéo),
en extrait l'audio, l'encode en HLS et expose l'avancement en temps réel. C'est le
« module de diffusion externe » évoqué par l'ADR-0005 de `new-life-server` : les octets
lourds (segments, transcodage) vivent ici, pas dans le serveur applicatif.

## Language

**Transcode**:
Un job de transcodage : la conversion d'un fichier source unique en un flux HLS
**audio uniquement**, identifié par un UUID v7. Porte un cycle de vie (PENDING →
PROCESSING → COMPLETED/FAILED) et une progression. La sortie ne contient jamais de
piste vidéo : une vidéo n'est acceptée que comme conteneur dont on extrait l'audio (`-vn`).
_Avoid_: Transcoding, Job, Conversion, Task

**Source**:
Le média d'origine d'un Transcode, fourni de deux façons : **téléversé** (`POST /upload`)
ou désigné par **URL** (`POST /transcodes`, ex. un objet S3). Téléversée, elle est écrite
sur le disque local, lue par le worker, puis supprimée à COMPLETED (une fois l'Archive
audio dans RustFS). Par URL, elle n'est **jamais copiée** localement : ffmpeg lit l'URL
directement, aucune Archive FLAC n'est produite, et l'URL (`source_url`) tient lieu de
master (ADR-0004).
_Avoid_: Original, Upload, Input file

**Archive audio**:
L'artefact durable et précieux d'un Transcode, poussé dans RustFS : aujourd'hui
**l'audio extrait sans perte (FLAC)** de la Source, jamais la vidéo. La stratégie
d'archivage est volontairement remplaçable — on pourrait un jour archiver la Source
d'origine intacte à la place. Distinct du HLS output (diffusion) : l'Archive est un
master de conservation/ré-encodage.
_Avoid_: Backup source, Master (seul)

**Cycle de vie du Transcode**:
`PENDING` (en file, source sur disque) → `PROCESSING` (ffmpeg en cours, 0→99 %) →
`COMPLETED` (master.m3u8 + segments prêts, servables par Caddy) **ou** `FAILED`.
Échec **permanent** (pas de piste audio, conteneur illisible) = FAILED direct, sans
retry. Échec **transitoire** (OOM, I/O, disque plein) = 3 tentatives backoff puis FAILED.
Sur COMPLETED **et** sur FAILED, la Source disque est supprimée (sur FAILED sans archivage).
_Avoid_: État, Statut (pour l'ensemble ; réserver `status` au champ)

**Rendu (rendition)**:
Une des variantes de qualité d'un HLS output. Ladder fixe à 3 rendus AAC-LC :
`low` 64 kbps, `mid` 128 kbps, `high` 192 kbps. 64 kbps est le plancher (en-dessous
la louange musicale se dégrade). Un `master.m3u8` liste les 3 ; le lecteur choisit
selon la bande passante (ABR).
_Avoid_: Variant, Quality (seul), Bitrate (seul)

**HLS output**:
La playlist `master.m3u8`, les playlists de rendu et les segments `.ts` audio produits
pour un Transcode. **Servi depuis RustFS** via Caddy (RustFS est l'origine de diffusion,
pas seulement une archive). La copie locale n'est qu'un **staging transitoire** : elle est
supprimée une fois le HLS poussé dans RustFS, pour que le disque applicatif reste borné.
_Avoid_: Stream, Rendus, Playlist (seul)

**Canal temps réel (SSE)**:
Le flux Server-Sent-Events sur lequel un client suit un Transcode en direct, un canal
par ressource nommé `transcodes/<id>` (séparateur `/`, calé sur la route). On y pousse
**exactement la même charge utile** que le poll de statut (`id, status, progress,
outputPlaylist, error`) : un seul contrat. La diffusion passe par le transport Redis de
Transmit, car le worker (qui encode) et le serveur HTTP (auquel le client est connecté)
sont deux processus distincts. Canal **ouvert** pour l'instant ; l'auth arrive au jalon H.
_Avoid_: WebSocket, Socket, Topic, Room

**Webhook de complétion / Callback**:
La notification HTTP `POST` que le service pousse vers une URL fournie **par upload**
(`callbackUrl`) quand un Transcode atteint un état terminal (COMPLETED **ou** FAILED). Le
corps est le payload unifié (`{ id, status, progress, outputPlaylist, error }`), livré par
un job dédié avec retries ; signé en HMAC SHA-256 (`X-Transcode-Signature`) si un
`callbackSecret` est fourni (voir ADR-0005). Absent d'URL, le service reste en polling/SSE.
_Avoid_: Notification, Ping, Hook (seul)

**Vérification déléguée (auth)**:
Le service ne connaît **rien** de l'authentification : un middleware relaie le jeton
porteur reçu vers un endpoint HTTP configuré (`AUTH_VERIFY_URL`) et n'autorise la requête
que si la réponse correspond (statut attendu, et éventuellement un corps attendu). Un jeton
valide **suffit** — le service reste ignorant de l'identité de l'appelant (ADR-0003).
_Avoid_: Guard, Login, Session, Token verifier (seul)

**RustFS**:
Le magasin d'objets S3-compatible qui joue **deux rôles** : origine de diffusion du
HLS output (servi via Caddy) **et** dépôt de l'Archive audio (FLAC). Ni la Source ni le
HLS ne s'accumulent sur le disque applicatif — tout ce qui est durable vit dans RustFS.
_Avoid_: S3, Bucket, Storage (seul)
