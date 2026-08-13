import { I18nException } from '#common/exceptions/i18n_exception'
import type { PlatformLang } from '#common/services/http_service'

/**
 * A Transcode a worker is holding right now cannot be deleted (ADR-0008).
 *
 * A conflict, not a rejection: the answer changes on its own within minutes,
 * once the job reaches a terminal state — or, if the worker died, once BullMQ's
 * stalled check hands the job back. A purge that retries always gets through.
 */
export class TranscodeInProgressException extends I18nException {
  static status = 409
  static code = 'E_TRANSCODE_IN_PROGRESS'

  get messages() {
    return {
      en: 'Transcode {{id}} is being processed right now and cannot be deleted; retry once it is done',
      fr: "Le transcode {{id}} est en cours de traitement et ne peut pas être supprimé ; réessayer une fois qu'il est terminé",
    }
  }

  constructor(lang: PlatformLang, id?: string) {
    super(lang, id ? { id } : {})
  }
}
