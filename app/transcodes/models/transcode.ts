import { compose } from '@adonisjs/core/helpers'
import { withUuid } from '#common/mixins/with_uuid'
import { TranscodeSchema } from '#database/schema'

/**
 * The durable state of a Transcode — the source of truth for its lifecycle
 * (see CONTEXT.md and ADR-0001/0002/0004).
 *
 * Columns are inherited from the generated `TranscodeSchema` (regenerated on
 * every `migration:run` by introspecting the database). `withUuid()` layers on
 * the self-assigned UUID v7 primary key that the generator does not emit.
 *
 * Volatile progress lives in Redis, never here: only lifecycle transitions are
 * written to Postgres.
 */
export default class Transcode extends compose(TranscodeSchema, withUuid()) {}
