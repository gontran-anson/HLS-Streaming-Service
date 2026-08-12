/**
 * The lifecycle states and source kinds of a Transcode (see CONTEXT.md).
 *
 * These unions are referenced by `database/schema_rules.ts` so the schema
 * generator types the `status` and `source_kind` columns precisely instead of
 * a bare `string`.
 */
export type TranscodeStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export type SourceKind = 'audio' | 'video'
