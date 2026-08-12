import { WebhookQueue } from '#transcodes/queues/webhook_queue'
import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Registers the webhook queue producer as a container singleton so the
 * finalization actions can inject it, and closes its Redis connection on
 * shutdown.
 *
 * Mirrors `queue_provider.ts`: only the instance that was actually created is
 * closed, so a process that never enqueued a webhook never opened the
 * connection.
 */
export default class WebhookProvider {
  private instance?: WebhookQueue

  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(WebhookQueue, () => {
      this.instance = new WebhookQueue()
      return this.instance
    })
  }

  async shutdown() {
    if (this.instance) {
      await this.instance.close()
    }
  }
}
