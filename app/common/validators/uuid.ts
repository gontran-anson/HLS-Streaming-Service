import vine from '@vinejs/vine'

/**
 * Reusable VineJS rule for a client-generated UUIDv7 identifier.
 *
 * Content-creation endpoints accept the id from the client so a record created
 * offline keeps the same id once synced (offline-first idempotent upsert). The
 * version is pinned to 7 to match the ids minted by `withUuid()`.
 */
export const uuidV7 = () => vine.string().uuid({ version: [7] })
