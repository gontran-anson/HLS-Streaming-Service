import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { TokenVerifier } from '#common/services/token_verifier'
import { TranscodeQueue } from '#transcodes/queues/transcode_queue'

/** A valid token, so requests get past auth and reach the route. */
function authed() {
  app.container.swap(TokenVerifier, () => {
    return { verify: async () => true } as unknown as TokenVerifier
  })
}

/** Stands in for the BullMQ queue with fixed, read-only snapshot data. */
function queueReturns(snapshot: {
  counts?: { waiting: number; active: number; failed: number }
  active?: { transcodeId: string; progress: number; startedAt: string; status: string }[]
  recentFailures?: { transcodeId: string; error: string | null; at: string }[]
}) {
  app.container.swap(TranscodeQueue, () => {
    return {
      jobCounts: async () => snapshot.counts ?? { waiting: 0, active: 0, failed: 0 },
      activeJobs: async () => snapshot.active ?? [],
      recentFailures: async () => snapshot.recentFailures ?? [],
    } as unknown as TranscodeQueue
  })
}

test.group('GET /ops/pipeline', (group) => {
  group.each.teardown(() => {
    app.container.restore(TokenVerifier)
    app.container.restore(TranscodeQueue)
  })

  test('without a token is 401', async ({ client }) => {
    queueReturns({})
    const response = await client.get('/ops/pipeline')
    response.assertStatus(401)
  })

  test('an invalid token is 401', async ({ client }) => {
    app.container.swap(TokenVerifier, () => {
      return { verify: async () => false } as unknown as TokenVerifier
    })
    queueReturns({})
    const response = await client.get('/ops/pipeline').header('Authorization', 'Bearer nope')
    response.assertStatus(401)
  })

  test('returns the ops snapshot shape from the queue', async ({ client, assert }) => {
    authed()
    queueReturns({
      counts: { waiting: 3, active: 1, failed: 2 },
      active: [
        {
          transcodeId: '0191ffff-0000-7000-8000-000000000301',
          progress: 62,
          startedAt: '2026-08-20T10:00:00.000Z',
          status: 'PROCESSING',
        },
      ],
      recentFailures: [
        {
          transcodeId: '0191ffff-0000-7000-8000-000000000302',
          error: 'no audio track',
          at: '2026-08-20T09:00:00.000Z',
        },
      ],
    })

    const response = await client.get('/ops/pipeline').header('Authorization', 'Bearer ok')

    response.assertStatus(200)
    const body = response.body()
    assert.deepEqual(body.counts, { waiting: 3, active: 1, failed: 2 })
    assert.deepEqual(body.active, [
      {
        transcodeId: '0191ffff-0000-7000-8000-000000000301',
        progress: 62,
        startedAt: '2026-08-20T10:00:00.000Z',
        status: 'PROCESSING',
      },
    ])
    assert.deepEqual(body.recentFailures, [
      {
        transcodeId: '0191ffff-0000-7000-8000-000000000302',
        error: 'no audio track',
        at: '2026-08-20T09:00:00.000Z',
      },
    ])
  })
})
