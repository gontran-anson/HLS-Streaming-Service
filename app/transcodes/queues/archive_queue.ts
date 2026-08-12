import { queueConnection } from '#config/queue'
import { Queue } from 'bullmq'

/** Second-stage queue: archive the FLAC and reclaim local disk (ADR-0004). */
export const ARCHIVE_QUEUE = 'archive'

export interface ArchiveJobData {
  id: string
  /** The transcode source (local path or remote URL). */
  source: string
  /** true = URL source: no local Source to delete, no FLAC to archive. */
  remote: boolean
}

/**
 * Producer of the archive/cleanup job. Enqueued by the transcode job **after**
 * COMPLETED, so a RustFS outage here retries independently and never re-encodes
 * (Q18). `jobId = id` keeps it idempotent.
 */
export class ArchiveQueue {
  private queue = new Queue<ArchiveJobData>(ARCHIVE_QUEUE, { connection: queueConnection })

  async enqueue(data: ArchiveJobData): Promise<void> {
    await this.queue.add('archive', data, {
      jobId: data.id,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
    })
  }

  async close(): Promise<void> {
    await this.queue.close()
  }
}
