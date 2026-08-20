import { test } from '@japa/runner'
import type Transcode from '#transcodes/models/transcode'
import { PipelineFirehose } from '#transcodes/services/pipeline_firehose'
import { TranscodePublisher } from '#transcodes/services/transcode_publisher'

const ID = '0191ffff-0000-7000-8000-000000000200'

/** A firehose that records what the publisher fans out, without a real Redis. */
class FirehoseSpy extends PipelineFirehose {
  events: unknown[] = []
  async publish(event: unknown): Promise<void> {
    this.events.push(event)
  }
}

/** A minimal Transcode-shaped stand-in — the transformer reads only these fields. */
function fakeTranscode(fields: Partial<Transcode> = {}): Transcode {
  return {
    id: ID,
    status: 'PROCESSING',
    outputPlaylist: null,
    error: null,
    ...fields,
  } as unknown as Transcode
}

test.group('TranscodePublisher raw firehose', () => {
  test('publishes the lifecycle event on the pipeline firehose', async ({ assert }) => {
    const firehose = new FirehoseSpy()
    const publisher = new TranscodePublisher(firehose)

    publisher.broadcast(fakeTranscode(), 42)

    assert.deepEqual(firehose.events, [
      {
        transcodeId: ID,
        status: 'PROCESSING',
        progress: 42,
        error: null,
        outputPlaylist: null,
      },
    ])
  })

  test('carries the terminal outcome (playlist / error) on the firehose', async ({ assert }) => {
    const firehose = new FirehoseSpy()
    const publisher = new TranscodePublisher(firehose)

    publisher.broadcast(
      fakeTranscode({ status: 'COMPLETED', outputPlaylist: 'https://m/hls/x/master.m3u8' }),
      100
    )

    assert.deepEqual(firehose.events, [
      {
        transcodeId: ID,
        status: 'COMPLETED',
        progress: 100,
        error: null,
        outputPlaylist: 'https://m/hls/x/master.m3u8',
      },
    ])
  })
})
