# L'URL publiée est absolue — le service dit *où*, pas seulement *quoi*

`outputPlaylist` porte désormais une **URL complète et fetchable** — `https://…/hls/<id>/master.m3u8` —
et non plus un chemin racine (`/hls/<id>/master.m3u8`). La base publique vient d'une variable
d'environnement, **`HLS_PUBLIC_BASE_URL`**, et la valeur change **dans les trois canaux à la fois** :
poll de statut, SSE et webhook servent la même forme, comme ils l'ont toujours fait.

## Pourquoi

Un chemin racine n'est pas une adresse : il n'a de sens que pour quelqu'un qui sait déjà sur quel
hôte les segments sont servis. Or **ce quelqu'un, c'est ce service** — c'est lui qui pousse dans
RustFS, lui qui connaît le préfixe du bucket, et lui que le `Caddyfile` du README accompagne. Laisser
l'appelant recomposer l'URL revient à dupliquer chez lui une connaissance qui vit ici, et à la lui
faire deviner à chaque déploiement.

Le consommateur immédiat, `new-life-server`, ne peut d'ailleurs **pas** l'accepter : son ADR-0005 lui
interdit toute hypothèse de chemin (« l'URL est **fournie par le module de streaming**, source de
vérité de l'emplacement réel ; l'API ne fait aucune hypothèse de chemin »), et sa colonne
`teachings.playlist_url` est validée comme URL absolue. Un chemin racine l'obligerait à violer sa
propre décision pour consommer la nôtre.

## Considered Options

- **Garder le chemin relatif, l'appelant préfixe** : rejeté — déplace chez l'appelant une
  connaissance qui n'est pas la sienne, et contredit ADR-0005 de `new-life-server`.
- **Publier les deux** (`outputPlaylist` relatif + `outputPlaylistUrl` absolu) : rejeté — deux champs
  qui disent la même chose finissent par se contredire, et l'appelant doit alors choisir.
- **Rendre la base obligatoire au démarrage** : retenu. `HLS_PUBLIC_BASE_URL` sans valeur produirait
  des URLs muettement fausses, découvertes par un lecteur qui ne joue pas. Mieux vaut refuser de
  démarrer.

## Consequences

- **Le contrat unifié change de forme.** README et `CONTEXT.md` sont à corriger ; tout appelant qui
  concaténait un hôte devant `outputPlaylist` obtiendrait une URL doublée.
- **L'URL est figée à la publication.** Un changement de domaine ou de CDN n'affecte pas les
  transcodes déjà notifiés ; c'est à l'appelant de réécrire ce qu'il a stocké. Ce n'est pas un défaut
  de ce choix : côté `new-life-server`, l'URL est de toute façon recopiée dans la base locale de
  chaque téléphone (son ADR-0026), donc le gel se produirait quel que soit le format publié.
- **`HLS_PUBLIC_BASE_URL` devient une variable de déploiement de premier rang**, au même titre que
  `RUSTFS_ENDPOINT` : elle décrit la **porte publique** (Caddy, CDN), pas l'origine interne.
