import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      /**
       * `database/schema.ts` is regenerated on every `migration:run` by
       * introspecting the live database; models extend the generated
       * `*Schema` classes. Per-column/table type refinements live in
       * `database/schema_rules.ts`.
       */
      schemaGeneration: {
        rulesPaths: ['#database/schema_rules'],
      },
    },
  },
})

export default dbConfig
