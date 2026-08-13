# Supprimer un Transcode — c'est la file qui décide, pas la colonne `status`

`DELETE /transcodes/:id` (issue #24) reprend **tout ce que ce service a produit** pour un
Transcode : le préfixe HLS dans RustFS, l'Archive audio s'il y en a une, le staging local
resté sur le disque, la progression résiduelle en Redis, et la ligne en base. Jamais la
Source de l'appelant : sur le chemin par URL, le master est **son** objet, et ce service n'y
a ni accès ni droit (**ADR-0007**) — l'absence d'archive n'y est donc pas une erreur, c'est
la règle.

Reste la question que l'issue demande de trancher : **que fait-on d'un Transcode encore
`PENDING` ou `PROCESSING` ?**

## La décision

Un Transcode est supprimable **exactement quand aucun worker ne le détient**. Ce n'est pas
le statut qui décide, c'est la file :

| Ce que dit la file | Réponse |
|---|---|
| Aucun job (terminé, drainé, Redis vidé) | `204`, suppression complète |
| Un job **en attente** (le cas normal d'un `PENDING`) | retiré de BullMQ, puis `204` |
| Un job **actif** — un worker écrit en ce moment | `409 E_TRANSCODE_IN_PROGRESS` |

Ce n'est donc **ni** « 409 sur tout ce qui n'est pas terminal », **ni** « suppression
inconditionnelle après retrait du job ». Les deux options de l'issue se trompent de critère :
elles regardent le statut, alors que ce qui rend une suppression vraie ou fausse, c'est la
présence d'un écrivain.

## Pourquoi pas un 409 sur tout `PENDING`

Un `PENDING` est précisément ce que l'appelant doit pouvoir purger. Un dépôt abandonné dont
le worker est à l'arrêt, ou une file en retard, reste `PENDING` **indéfiniment** — avec sa
Source de 2 Go sur le disque applicatif. Refuser sa suppression rendrait la purge de
`new-life-server` impuissante exactement là où elle sert le plus, et ferait de cette route
une promesse creuse.

Et il n'y a rien à protéger : un job en attente se retire proprement, rien n'a été produit,
aucune seconde de CPU n'a été dépensée. Le retrait précède la destruction, donc aucun job ne
peut se réveiller après coup pour repousser des octets dans un bucket dont plus aucune ligne
ne répond.

## Pourquoi pas une suppression inconditionnelle

Un job **actif** détient les artefacts. `ProcessTranscode` pousse le HLS vers RustFS **avant**
de passer `COMPLETED` (ADR-0004) : effacer le préfixe pendant qu'il encode, c'est se faire
réécrire les octets une minute plus tard, sans ligne pour les référencer — la fuite invisible
que cette route existe pour empêcher. Répondre `204` alors qu'on ne peut pas rendre la
suppression vraie serait le même mensonge que la purge sans effet dénoncée par l'issue.

L'autre issue serait d'interrompre `ffmpeg`, ce que l'issue #24 met **explicitement hors
périmètre**. Le `409` est donc la seule réponse honnête : *pas maintenant*, pas *jamais*.

## Pourquoi la file, et pas la colonne `status`

`status` est un indice, pas une preuve. Il dit `PENDING` une milliseconde encore après qu'un
worker a pris le job, et il dit `PROCESSING` pour toujours si ce worker est mort. Lire
Postgres puis supprimer, c'est un « vérifier-puis-agir » qui n'est atomique à aucun moment.

BullMQ, lui, **refuse de retirer un job verrouillé** : ce refus *est* la réponse, et il tombe
du bon côté de la course. On ne demande donc pas « quel est le statut ? » mais « peux-tu me
rendre ce job ? ».

Corollaire important : **le `409` n'est jamais un piège**. Un worker mort perd son verrou, le
contrôle des jobs bloqués de BullMQ rend le job à la file ou le passe en échec, et le
Transcode redevient retirable. La fenêtre de refus est bornée par construction — quelques
minutes d'encodage, pas la vie du dépôt.

## La file d'archivage compte autant

Le second job (ADR-0004) pousse le FLAC après `COMPLETED`. S'il partait après la suppression,
il recréerait une Archive audio que plus rien ne référence. Il est donc retiré comme l'autre,
et un archivage **en cours** refuse la suppression pour la même raison : quelqu'un écrit.

## L'idempotence porte sur l'effet, pas sur le code

Supprimer deux fois laisse le service dans le **même état** — c'est la définition HTTP d'une
méthode idempotente, et c'est ce qui rend sûre une purge qui relance après un timeout : chaque
étape est indulgente (archive absente, préfixe vide, clé Redis expirée, job disparu), donc une
reprise converge au lieu d'échouer à mi-chemin.

Le second appel répond en revanche `404 E_TRANSCODE_NOT_EXISTS`, pas `204` : après la première
suppression, l'`id` est un `id` inconnu, et l'issue demande qu'un `id` inconnu réponde `404`,
comme la route de statut. Un appelant lit ce `404` pour ce qu'il est — *déjà purgé* — et
continue.

## Considered Options

- **`409` sur tout Transcode non terminal** : le plus simple à écrire, rejeté parce qu'il rend
  un dépôt `PENDING` indéfiniment impurgeable dès que le worker est à l'arrêt — c'est-à-dire
  au moment précis où la purge compte.
- **Suppression inconditionnelle après retrait du job** : rejeté — sur un job actif, le retrait
  échoue et le worker réécrit dans RustFS après notre passage. On répondrait `204` à une
  suppression qui ne tient pas.
- **Annuler le job en vol** (tuer `ffmpeg`, nettoyer l'état partiel) : rejeté, hors périmètre
  de l'issue #24 — beaucoup de plomberie pour épargner quelques minutes à un appelant qui s'est
  trompé de fichier.
- **Répondre `204` pour un `id` inconnu**, afin que deux suppressions renvoient le même code :
  rejeté — cela contredirait le `404` de la route de statut et masquerait une erreur d'`id`
  derrière un succès.

## Consequences

- **L'appelant doit traiter `404` comme un succès de purge** et **`409` comme un « réessaie »**.
  Les deux sont attendus dans une purge qui relance ; aucun n'est une anomalie à alerter.
- **Le délai de grâce reste chez l'appelant** (issue #24) : ce service ne décide jamais *quand*
  supprimer, il exécute.
- **Ordre imposé** : retirer les jobs, détruire les octets, **puis** la ligne. Une panne au
  milieu laisse une ligne qu'une reprise achève — jamais des octets orphelins que plus rien ne
  désigne. C'est le même arbitrage que l'ADR-0004 : ce qui coûte cher à retrouver passe en
  dernier.
- **Le disque borné de l'ADR-0004 vaut aussi à la suppression** : le staging HLS, le FLAC local
  et la Source téléversée sont repris. La Source est retrouvée par son nom `<id>.<ext>`, seul
  lien qui subsiste (l'extension n'est pas en base).
- **Une clé d'archive n'est pas nécessaire pour reprendre l'archive** : à défaut d'`archive_key`
  déjà enregistrée, la clé déterministe `archives/<id>.flac` est visée — sinon un FLAC poussé
  juste avant l'écriture de la colonne survivrait à son Transcode.
