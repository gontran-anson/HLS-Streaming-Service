import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import logger from '@adonisjs/core/services/logger'
import { queueConnection, workerConcurrency } from '#config/queue'
import { TRANSCODE_QUEUE, type TranscodeJobData } from '#transcodes/queues/transcode_queue'
import { Worker } from 'bullmq'

/**
 * `node ace transcode:work` — the long-running worker process (jalon D).
 *
 * A separate process from the HTTP server: it pulls transcode jobs off the
 * BullMQ queue and (later) runs ffprobe/ffmpeg. `staysAlive` keeps it up after
 * `run()` returns; the worker is drained cleanly on SIGTERM via the app's
 * `terminating` hook (the process is expected to run under a supervisor).
 *
 * The job processor is a skeleton for now — the encoding pipeline lands in
 * jalon E (#5).
 */
export default class TranscodeWorker extends BaseCommand {
  static commandName = 'transcode:work'
  static description = 'Run the transcode worker: consume queued jobs and encode audio HLS'
  static options: CommandOptions = { startApp: true, staysAlive: true }

  async run() {
    const worker = new Worker<TranscodeJobData>(
      TRANSCODE_QUEUE,
      async (job) => {
        // jalon E (#5): ffprobe (duration + audio track) -> single ffmpeg pass
        // (3 AAC renditions + FLAC) -> progress in Redis -> COMPLETED/FAILED.
        this.logger.info(
          `picked up transcode ${job.data.id} (${job.data.sourceKind}) at ${job.data.sourcePath}`
        )
      },
      { connection: queueConnection, concurrency: workerConcurrency }
    )

    worker.on('failed', (job, error) => {
      logger.error({ err: error, jobId: job?.id }, 'transcode job failed')
    })

    this.logger.info(`transcode worker ready (concurrency=${workerConcurrency})`)

    this.app.terminating(async () => {
      await worker.close()
    })
  }
}
