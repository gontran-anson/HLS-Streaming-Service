import { ArchiveQueue } from '#transcodes/queues/archive_queue'
import { RustfsStorage } from '#transcodes/services/rustfs_storage'
import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Binds the RustFS storage and the archive-queue producer as singletons, and
 * closes the queue's Redis connection on shutdown (only if it was opened).
 */
export default class ArchiveProvider {
  private queue?: ArchiveQueue

  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(RustfsStorage, () => new RustfsStorage())
    this.app.container.singleton(ArchiveQueue, () => {
      this.queue = new ArchiveQueue()
      return this.queue
    })
  }

  async shutdown() {
    if (this.queue) {
      await this.queue.close()
    }
  }
}
