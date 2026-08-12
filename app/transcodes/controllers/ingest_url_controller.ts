import { CreateTranscode } from '#transcodes/actions/create_transcode'
import { TranscodeQueue } from '#transcodes/queues/transcode_queue'
import TranscodeTransformer from '#transcodes/transformers/transcode_transformer'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { v7 as uuidv7 } from 'uuid'
import vine from '@vinejs/vine'

/**
 * `POST /transcodes` — ingest a Source by **URL** instead of uploading it.
 *
 * The caller passes a full, fetchable URL (e.g. an S3 object). ffmpeg reads it
 * directly, so nothing is staged or archived locally and the original is never
 * re-stored — the URL is recorded as the master (ADR-0004). Everything after is
 * identical to an upload: same PENDING → COMPLETED lifecycle, same HLS in RustFS,
 * same 202 contract and same notifications.
 */
@inject()
export default class IngestUrlController {
  constructor(
    private createTranscode: CreateTranscode,
    private transcodeQueue: TranscodeQueue
  ) {}

  private static validator = vine.create({
    sourceUrl: vine
      .string()
      .url({ require_protocol: true, protocols: ['http', 'https'] })
      .maxLength(2048),
    callbackUrl: vine
      .string()
      .url({ require_protocol: true, protocols: ['http', 'https'] })
      .maxLength(2048)
      .optional(),
    callbackSecret: vine.string().maxLength(512).optional(),
  })

  /**
   * @handle
   * @summary Ingest a source by URL
   * @operationId ingestUrl
   * @description Create an audio-HLS Transcode from a full source URL (e.g. S3).
   * ffmpeg reads the URL directly — no local copy, no FLAC archive; the URL is
   * kept as the master. Responds 202 with the created Transcode; media validation
   * (a decodable audio track) happens asynchronously in the worker.
   * @requestBody {"sourceUrl":"https://bucket.example.com/audio.mp3"}
   * @responseBody 202 - <Transcode>
   * @responseBody 422 - {"code":"E_VALIDATION_ERROR"}
   */
  async handle({ request, response, serialize }: HttpContext) {
    const { sourceUrl, callbackUrl, callbackSecret } = await request.validateUsing(
      IngestUrlController.validator
    )

    const id = uuidv7()
    const transcode = await this.createTranscode.execute({
      id,
      originalFilename: urlBasename(sourceUrl),
      sourceUrl,
      callbackUrl,
      callbackSecret,
    })

    await this.transcodeQueue.enqueue({
      id,
      source: sourceUrl,
      sourceKind: transcode.sourceKind,
      remote: true,
    })

    response.status(202)
    return serialize(TranscodeTransformer.transform(transcode))
  }
}

/** The last path segment of a URL, for admin display only. */
function urlBasename(url: string): string {
  try {
    const name = new URL(url).pathname.split('/').pop()
    return name ? decodeURIComponent(name) : 'source'
  } catch {
    return 'source'
  }
}
