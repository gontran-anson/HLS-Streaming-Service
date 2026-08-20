import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * Per-column type refinements applied by the schema generator when it writes
 * `database/schema.ts`. Without these, the enum columns would be typed as a
 * bare `string`; we close them onto their unions so the compiler catches an
 * invalid status or source kind.
 */
const statusColumn = {
  tsType: 'TranscodeStatus',
  imports: [{ source: '#transcodes/support/transcode_enums', typeImports: ['TranscodeStatus'] }],
  decorators: [{ name: '@column' }],
}

const sourceKindColumn = {
  tsType: 'SourceKind',
  imports: [{ source: '#transcodes/support/transcode_enums', typeImports: ['SourceKind'] }],
  decorators: [{ name: '@column' }],
}

// The per-upload HMAC secret is a credential: never serialized back to a client
// (upload 202, status poll). `serializeAs: null` drops it from every payload.
const callbackSecretColumn = {
  tsType: 'string',
  decorators: [{ name: '@column', args: { serializeAs: null } }],
}

// The download renditions blob (ADR-0009). A bare jsonb would be typed `any`;
// close it onto the shared `DownloadRenditionInfo[]` shape so the compiler
// checks every read and write. `prepare`/`consume` are applied in the model
// (they cannot be expressed here), keeping the pg round-trip explicit.
const downloadsColumn = {
  tsType: 'DownloadRenditionInfo[]',
  imports: [{ source: '#transcodes/support/hls', typeImports: ['DownloadRenditionInfo'] }],
  decorators: [{ name: '@column' }],
}

export default {
  tables: {
    transcodes: {
      columns: {
        status: statusColumn,
        source_kind: sourceKindColumn,
        callback_secret: callbackSecretColumn,
        downloads: downloadsColumn,
      },
    },
  },
} satisfies SchemaRules
