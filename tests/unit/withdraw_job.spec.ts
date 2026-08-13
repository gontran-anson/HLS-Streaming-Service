import { test } from '@japa/runner'
import { withdrawJob, type WithdrawableQueue } from '#transcodes/support/withdraw_job'

/** A queue holding one job in a given state, with a recorded `remove()`. */
function queueWith(job: { active: boolean; removeFails?: boolean }) {
  const calls = { removed: 0 }
  const queue: WithdrawableQueue = {
    getJob: async () => ({
      isActive: async () => job.active,
      remove: async () => {
        calls.removed += 1
        if (job.removeFails) {
          throw new Error('Job 1 could not be removed because it is locked by another worker')
        }
      },
    }),
  }
  return { queue, calls }
}

test.group('withdrawJob', () => {
  test('an absent job leaves the Transcode unowned', async ({ assert }) => {
    const queue: WithdrawableQueue = { getJob: async () => undefined }
    assert.isTrue(await withdrawJob(queue, 'id-1'))
  })

  test('a queued job is removed and the Transcode freed', async ({ assert }) => {
    const { queue, calls } = queueWith({ active: false })
    assert.isTrue(await withdrawJob(queue, 'id-1'))
    assert.equal(calls.removed, 1)
  })

  test('an active job keeps the Transcode owned, and is never removed', async ({ assert }) => {
    const { queue, calls } = queueWith({ active: true })
    assert.isFalse(await withdrawJob(queue, 'id-1'))
    assert.equal(calls.removed, 0)
  })

  test('a job locked between the check and the removal keeps it owned', async ({ assert }) => {
    // The race: a worker picks the job up right after isActive() said no.
    // BullMQ's refusal is the answer — it must read as ownership, not as an error.
    const { queue } = queueWith({ active: false, removeFails: true })
    assert.isFalse(await withdrawJob(queue, 'id-1'))
  })
})
