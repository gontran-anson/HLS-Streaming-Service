import { compose } from '@adonisjs/core/helpers'
import { column } from '@adonisjs/lucid/orm'
import { withUuid } from '#common/mixins/with_uuid'
import { TranscodeSchema } from '#database/schema'
import type { DownloadRenditionInfo } from '#transcodes/support/hls'

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
export default class Transcode extends compose(TranscodeSchema, withUuid()) {
  /**
   * The download renditions blob (ADR-0009), overriding the generated column to
   * carry the jsonb round-trip explicitly. `pg` would otherwise format a JS
   * array as a Postgres *array literal* (`{...}`) and the `jsonb` insert fails
   * with "invalid input syntax for type json"; `prepare` serializes to a JSON
   * string on write, and `consume` tolerates a driver that hands back either a
   * parsed value or a raw string on read.
   */
  @column({
    prepare: (value: DownloadRenditionInfo[] | null) =>
      value === null || value === undefined ? value : JSON.stringify(value),
    consume: (value: unknown): DownloadRenditionInfo[] | null => {
      if (value === null || value === undefined) return null
      return (typeof value === 'string' ? JSON.parse(value) : value) as DownloadRenditionInfo[]
    },
  })
  declare downloads: DownloadRenditionInfo[] | null
}
