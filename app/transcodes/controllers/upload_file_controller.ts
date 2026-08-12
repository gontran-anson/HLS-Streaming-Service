import { CreateTranscode } from '#transcodes/actions/create_transcode'
import { SourceStore } from '#common/services/source_store'
import { TranscodeQueue } from '#transcodes/queues/transcode_queue'
import TranscodeTransformer from '#transcodes/transformers/transcode_transformer'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { v7 as uuidv7 } from 'uuid'
import vine from '@vinejs/vine'

/**
 * `POST /upload` — receives a Source (audio or video) and enqueues an
 * audio-HLS Transcode (ADR-0001).
 *
 * The synchronous slice only: mint the id, land the Source on local disk, and
 * persist a PENDING row. Probing, encoding, progress and cleanup are the
 * worker's job (later jalons); this returns `202` immediately.
 *
 * The id is server-generated (ADR-0002); the client cannot impose it, and the
 * Source is written under that id, never under the client file name.
 */
@inject()
export default class UploadFileController {
  constructor(
    private createTranscode: CreateTranscode,
    private sourceStore: SourceStore,
    private transcodeQueue: TranscodeQueue
  ) {}

  private static validator = vine.create({
    file: vine.file({
      size: '2gb',
      extnames: [
        // audio
        'mp3',
        'm4a',
        'aac',
        'flac',
        'ogg',
        'wav',
        // video (container only — the video track is discarded, ADR-0001)
        'mp4',
        'mkv',
        'mov',
        'webm',
        'avi',
        'wmv',
      ],
    }),
  })

  /**
   * @handle
   * @summary Upload a source for audio-HLS transcoding
   * @operationId uploadFile
   * @description Accept an audio or video file, store it, and enqueue an
   * audio-only HLS Transcode. The video track of a video container is
   * discarded. Responds 202 with the created Transcode (id + PENDING status);
   * media validation (audio track present, decodable) happens asynchronously in
   * the worker and may later flip the Transcode to FAILED.
   * @requestBody {"file":"<file>"}
   * @responseBody 202 - <Transcode>
   * @responseBody 422 - {"code":"E_VALIDATION_ERROR"}
   */
  async handle({ request, response, serialize }: HttpContext) {
    const { file } = await request.validateUsing(UploadFileController.validator)

    const id = uuidv7()
    const sourcePath = await this.sourceStore.save(file, id)

    const transcode = await this.createTranscode.execute({
      id,
      originalFilename: file.clientName,
    })

    // Hand off to the worker (jalon D): jobId = id makes a re-submitted upload
    // idempotent. The row is already PENDING, so a queue hiccup never loses the
    // record — it can be re-enqueued.
    await this.transcodeQueue.enqueue({ id, sourcePath, sourceKind: transcode.sourceKind })

    response.status(202)
    return serialize(TranscodeTransformer.transform(transcode))
  }
}
