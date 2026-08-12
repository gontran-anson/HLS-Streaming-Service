import Transcode from '#transcodes/models/transcode'
import { RessourceNotExistsException } from '#common/exceptions/ressource_not_exists_exception'
import { PlatformLang } from '#common/services/http_service'

export interface FindTranscodeParams {
  id: string
  lang?: PlatformLang
}

/**
 * Loads a single Transcode by id, or fails with a 404 (`E_TRANSCODE_NOT_EXISTS`).
 *
 * The only layer that touches the model. Authorization is out of scope here —
 * the status endpoint is open until jalon H (#8). Volatile progress is not read
 * here: the durable row is the source of truth for `status`, and progress is
 * merged from Redis by the reading layer (jalon D).
 */
export class FindTranscode {
  async execute(params: FindTranscodeParams): Promise<Transcode> {
    const transcode = await Transcode.find(params.id)

    if (!transcode) {
      throw new RessourceNotExistsException(params.lang ?? PlatformLang.en, 'transcode', params.id)
    }

    return transcode
  }
}
