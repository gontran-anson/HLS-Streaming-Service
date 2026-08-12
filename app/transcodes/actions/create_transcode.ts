import Transcode from '#transcodes/models/transcode'
import type { SourceKind } from '#transcodes/support/transcode_enums'
import { fileKind } from '#common/utils/file_agent'

export interface CreateTranscodeParams {
  /** The server-minted UUID v7; the Source on disk is already named after it. */
  id: string
  /** The client file name — kept for admin display only, never a disk path. */
  originalFilename: string
}

/**
 * Creates a Transcode in its initial PENDING state (see CONTEXT.md, ADR-0002).
 *
 * The only layer allowed to touch the model. It derives `source_kind` from the
 * file name via `fileKind()` — the upload validator has already narrowed the
 * extension to the accepted media set, so the kind is always `audio` or
 * `video`. Volatile progress is never written here (Redis owns it).
 */
export class CreateTranscode {
  async execute(params: CreateTranscodeParams): Promise<Transcode> {
    const sourceKind: SourceKind = fileKind(params.originalFilename) === 'audio' ? 'audio' : 'video'

    return Transcode.create({
      id: params.id,
      status: 'PENDING',
      originalFilename: params.originalFilename,
      sourceKind,
    })
  }
}
