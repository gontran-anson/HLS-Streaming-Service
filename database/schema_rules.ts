import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * Per-column type refinements applied by the schema generator when it writes
 * `database/schema.ts`. Without these, the enum columns would be typed as a
 * bare `string`; we close them onto their unions so the compiler catches an
 * invalid status or source kind.
 */
const statusColumn = {
  tsType: 'TranscodeStatus',
  imports: [{ source: '#models/support/transcode_enums', typeImports: ['TranscodeStatus'] }],
  decorators: [{ name: '@column' }],
}

const sourceKindColumn = {
  tsType: 'SourceKind',
  imports: [{ source: '#models/support/transcode_enums', typeImports: ['SourceKind'] }],
  decorators: [{ name: '@column' }],
}

export default {
  tables: {
    transcodes: {
      columns: {
        status: statusColumn,
        source_kind: sourceKindColumn,
      },
    },
  },
} satisfies SchemaRules
