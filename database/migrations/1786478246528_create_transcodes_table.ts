import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transcodes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      // Primary key is a client-visible UUID v7, assigned in the application
      // layer by `withUuid()` (no SQL default), never a serial.
      table.uuid('id').primary().notNullable()

      table
        .enum('status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
        .notNullable()
        .defaultTo('PENDING')

      // Caddy path to the master playlist, null until COMPLETED.
      table.text('output_playlist').nullable()

      // Reason of the FAILED state, null otherwise.
      table.text('error').nullable()

      // Client-provided name, kept for admin display only — never a disk path.
      table.text('original_filename').notNullable()

      table.enum('source_kind', ['audio', 'video']).notNullable()

      // From ffprobe; null when the media exposes no reliable duration.
      // `double` so the generator types it as `number` (a `decimal` would be a string).
      table.double('duration_seconds').nullable()

      // RustFS key of the archived lossless audio (FLAC), set by the archive job.
      table.text('archive_key').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
