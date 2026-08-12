# L'`id` d'un Transcode est généré par le serveur

Le contrôleur d'upload **génère** l'UUID v7 du Transcode et le renvoie dans le `202`. Le
client ne peut **pas** imposer l'`id`.

## Considered Options

Le dépôt possède un pattern d'`id` **fourni par le client** (`app/common/validators/uuid.ts`,
`app/common/mixins/with_uuid.ts`), pensé pour l'offline-first idempotent (un enregistrement
créé hors-ligne garde son `id` à la synchro). Ce pattern **ne s'applique pas ici** : un
upload de plusieurs Go n'est pas un scénario mobile offline, l'idempotence d'un binaire
lourd se gère par hash de contenu et non par `id` client, et laisser un client choisir
l'`id` d'un job de traitement ouvre une surface de collision/écrasement.

## Consequences

- Le paramètre `identifier` de l'ébauche d'upload est supprimé.
- Sans ADR, un lecteur voyant le mixin `withUuid()` « corrigerait » en acceptant l'`id`
  client, croyant à un oubli. Ce n'en est pas un.
