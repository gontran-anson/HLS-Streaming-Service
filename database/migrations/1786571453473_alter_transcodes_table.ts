import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transcodes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Set when the Source is ingested by URL instead of an upload: the
      // original stays at this URL (ffmpeg reads it directly, no local copy,
      // no FLAC archive — the URL *is* the master pointer).
      table.text('source_url').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('source_url')
    })
  }
}
