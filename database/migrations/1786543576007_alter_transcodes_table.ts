import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transcodes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Caller-provided completion webhook (jalon I). Null → no webhook fired.
      table.text('callback_url').nullable()

      // Optional per-upload HMAC secret used to sign the webhook body; never
      // serialized back to any client (schema_rules → serializeAs: null).
      table.text('callback_secret').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('callback_url')
      table.dropColumn('callback_secret')
    })
  }
}
