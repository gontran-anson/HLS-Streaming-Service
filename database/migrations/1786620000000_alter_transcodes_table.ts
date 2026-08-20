import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transcodes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // The three progressive download renditions (ADR-0009), persisted as one
      // JSON blob: an array of `{ name, url, bytes }` — the rung name, its
      // absolute unsigned public URL and the byte size measured locally at
      // encode time. One blob, not three columns per axis, because the
      // renditions are a set that is always written and read together at
      // COMPLETED, and it mirrors the completion-webhook payload 1:1. No
      // per-rendition bitrate is stored — the ladder stays implicit (ADR-0001).
      // Null until COMPLETED, like `output_playlist`.
      table.jsonb('downloads').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('downloads')
    })
  }
}
