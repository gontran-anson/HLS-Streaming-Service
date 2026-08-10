import { v7 as uuidv7 } from 'uuid'
import { BaseModel, beforeCreate } from '@adonisjs/lucid/orm'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'

/**
 * Mixin that turns a model into a UUIDv7-keyed model.
 *
 * The schema generator already maps a native Postgres `uuid` primary key to
 * `@column({ isPrimary: true }) declare id: string`, but it never emits
 * `selfAssignPrimaryKey`. This mixin supplies that flag and assigns a v7 id in
 * the application layer (no SQL default), so a client-provided id is preserved
 * (offline-first) and a server-created row still gets a fresh, index-local id.
 *
 * Usage: `class Foo extends compose(FooSchema, withUuid()) {}`
 */
export function withUuid() {
  return <Model extends NormalizeConstructor<typeof BaseModel>>(superclass: Model) => {
    class UuidModel extends superclass {
      static selfAssignPrimaryKey = true

      @beforeCreate()
      static assignUuid(model: { id?: string }) {
        if (!model.id) {
          model.id = uuidv7()
        }
      }
    }

    return UuidModel
  }
}
