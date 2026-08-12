# Webhook de complétion — notification poussée à la finalisation du Transcode

À la finalisation d'un Transcode, le service **pousse** son état terminal vers une URL
fournie par l'appelant, au lieu de le forcer à sonder `GET /transcodes/:id/status`. L'URL
(`callbackUrl`) et un secret optionnel (`callbackSecret`) sont fournis **par upload**, en
champs facultatifs du `POST /upload`, et persistés sur le Transcode. **Pas d'URL → pas de
webhook** : le polling/SSE reste la voie par défaut.

Le webhook **se déclenche sur les deux états terminaux** : `COMPLETED` (portant
`outputPlaylist`) **et** `FAILED` (portant `error`). Le corps est la **forme de payload
unifiée** du `TranscodeTransformer` — `{ id, status, progress, outputPlaylist, error }` —
la même que le poll de statut et le SSE, `Content-Type: application/json`.

La livraison est un **job BullMQ dédié** (queue `webhook`), jamais un POST synchrone dans
l'encode : une finalisation enfile un job qui POSTe le payload via `fetch` (timeout 10 s,
`AbortController`). Succès = **2xx** ; tout autre statut ou timeout **relance** (`attempts:
5`, backoff exponentiel 5 s). Un appelant momentanément indisponible ne bloque donc jamais
le worker d'encodage, et la remise survit à une panne réseau brève.

Quand un `callbackSecret` est présent, le corps **exact** envoyé est signé en **HMAC
SHA-256** et la signature voyage dans l'en-tête `X-Transcode-Signature: sha256=<hex>` ;
l'appelant recalcule le HMAC du corps brut reçu pour authentifier l'origine. Pas de secret
→ pas d'en-tête de signature.

## Considered Options

- **Polling/SSE seul** (déjà en place) : suffisant mais impose à l'appelant une boucle
  d'attente ; le webhook le décharge sur les intégrations serveur-à-serveur.
- **POST synchrone dans l'action d'encode** : rejeté — un appelant lent ferait traîner ou
  échouer l'encode, et il n'y aurait pas de reprise.
- **Signature via un secret global du service** : rejeté au profit d'un secret **par
  upload**, cohérent avec l'ADR-0003 (le service ne détient aucun secret partagé global).

## Consequences

- Le `callback_secret` est un **credential** : la règle de schéma le marque
  `serializeAs: null`, il n'apparaît donc **jamais** dans une réponse d'API (202 d'upload,
  poll de statut).
- Deux nouvelles colonnes nullables (`callback_url`, `callback_secret`) et une seconde
  queue/worker BullMQ (`webhook`) drainés dans le même process worker.
- La remise est **au moins une fois** : un appelant qui répond 2xx après un timeout de 10 s
  peut recevoir un doublon. L'`id` du payload rend le traitement idempotent côté appelant.
