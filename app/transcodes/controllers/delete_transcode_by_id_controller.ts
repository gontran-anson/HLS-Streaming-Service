import { DeleteTranscode } from '#transcodes/actions/delete_transcode'
import { uuidV7 } from '#common/validators/uuid'
import { resolveLang } from '#common/utils/request_lang'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

/**
 * `DELETE /transcodes/:id` — reclaim a Transcode's HLS and archive (issue #24).
 *
 * Removes everything this service produced and answers `204` with no body: the
 * caller already knows the id, and there is nothing left to describe.
 *
 * Error codes follow the status route — `422` for a malformed id, `404` for one
 * we do not have — plus a `409` while a worker holds the Transcode (ADR-0008).
 * A second delete on the same id is a `404`: the effect is identical, which is
 * what makes a purge that reruns after a timeout safe, and callers read 404 as
 * "already gone".
 */
@inject()
export default class DeleteTranscodeByIdController {
  constructor(private deleteTranscode: DeleteTranscode) {}

  private static validator = vine.compile(vine.object({ id: uuidV7() }))

  /**
   * @handle
   * @summary Delete a transcode
   * @operationId deleteTranscode
   * @description Delete everything the service produced for a Transcode: the
   * HLS output in RustFS, the FLAC archive when there is one (a URL ingestion
   * has none), any residual progress and the row itself. The caller's own
   * source object is never touched. Responds 204.
   * @paramPath id - Transcode UUID v7 - @type(string) @required
   * @responseBody 204 - {}
   * @responseBody 404 - {"code":"E_TRANSCODE_NOT_EXISTS"}
   * @responseBody 409 - {"code":"E_TRANSCODE_IN_PROGRESS"}
   * @responseBody 422 - {"code":"E_VALIDATION_ERROR"}
   */
  async handle({ params, request, response }: HttpContext) {
    const { id } = await DeleteTranscodeByIdController.validator.validate({ id: params.id })

    await this.deleteTranscode.execute({ id, lang: resolveLang(request) })

    return response.noContent()
  }
}
