import Transcode from '#transcodes/models/transcode'
import { ProgressStore } from '#transcodes/services/progress_store'
import { TranscodePublisher } from '#transcodes/services/transcode_publisher'
import { inject } from '@adonisjs/core'

export interface FailTranscodeParams {
  id: string
  reason: string
}

/**
 * Marks a Transcode FAILED with its reason and drops the volatile progress.
 *
 * Called by the worker once a job is terminal — a permanent error, or a
 * transient one whose retries are exhausted (see the design, Q9). Idempotent
 * and forgiving: a missing row is a no-op.
 */
@inject()
export class FailTranscode {
  constructor(
    private progressStore: ProgressStore,
    private publisher: TranscodePublisher
  ) {}

  async execute(params: FailTranscodeParams): Promise<void> {
    const transcode = await Transcode.find(params.id)
    if (!transcode) return

    transcode.status = 'FAILED'
    transcode.error = params.reason
    await transcode.save()
    await this.progressStore.clear(params.id)
    this.publisher.broadcast(transcode)
  }
}
