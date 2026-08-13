/**
 * The slice of a BullMQ job the withdrawal needs. Structural on purpose: it
 * keeps this rule testable without a Redis, and states plainly that nothing
 * else about the job matters here.
 */
interface WithdrawableJob {
  isActive(): Promise<boolean>
  remove(): Promise<void>
}

/** The slice of a BullMQ queue the withdrawal needs (see `WithdrawableJob`). */
export interface WithdrawableQueue {
  getJob(jobId: string): Promise<WithdrawableJob | undefined>
}

/**
 * Takes a job back off its queue and reports whether the Transcode is now
 * **unowned** — the precondition of a deletion (ADR-0008).
 *
 * Returns `true` when nothing holds the Transcode any more:
 *
 * - **no job at all** — never enqueued, already drained, or the queue was
 *   flushed. Absence is not a failure: a delete only cares that no worker is
 *   about to write;
 * - **a waiting/delayed/failed job we removed** — a PENDING Transcode is
 *   withdrawn before it ever costs a CPU second.
 *
 * Returns `false` only when a **worker currently holds** the job. The queue,
 * not the `status` column, is the arbiter: the row can say PROCESSING while the
 * job is stalled or gone, and it can say PENDING a millisecond after a worker
 * grabbed it. BullMQ refuses to remove a locked job — that refusal *is* the
 * answer, and it is race-free in a way that reading Postgres first can never be.
 */
export async function withdrawJob(queue: WithdrawableQueue, jobId: string): Promise<boolean> {
  const job = await queue.getJob(jobId)
  if (!job) return true
  if (await job.isActive()) return false

  try {
    await job.remove()
    return true
  } catch {
    // The only expected throw is "locked by another worker": a worker picked the
    // job up between our check and our removal. Treat it as ownership, not as an
    // outage — the caller retries and wins the next round.
    return false
  }
}
