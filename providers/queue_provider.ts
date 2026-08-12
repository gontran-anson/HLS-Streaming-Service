import { TranscodeQueue } from '#transcodes/queues/transcode_queue'
import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Registers the transcode queue producer as a container singleton so the upload
 * controller can inject it, and closes its Redis connection on shutdown.
 *
 * Only the instance that was actually created is closed: an app that never
 * enqueued (e.g. the worker process, or a test) never opened the connection.
 */
export default class QueueProvider {
  private instance?: TranscodeQueue

  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(TranscodeQueue, () => {
      this.instance = new TranscodeQueue()
      return this.instance
    })
  }

  async shutdown() {
    if (this.instance) {
      await this.instance.close()
    }
  }
}
