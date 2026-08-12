import { test } from '@japa/runner'
import TranscodeTransformer from '#transcodes/transformers/transcode_transformer'
import type Transcode from '#transcodes/models/transcode'

/** A Transcode-shaped stub — the transformer only reads plain columns. */
function transcode(fields: Record<string, unknown>): Transcode {
  return fields as unknown as Transcode
}

test.group('TranscodeTransformer', () => {
  test('serves exactly the unified 5-field shape', ({ assert }) => {
    const out = new TranscodeTransformer(
      transcode({ id: 'id-1', status: 'PENDING', outputPlaylist: null, error: null })
    ).toObject()
    assert.deepEqual(Object.keys(out).sort(), [
      'error',
      'id',
      'outputPlaylist',
      'progress',
      'status',
    ])
  })

  test('derives progress from status when no live value is passed', ({ assert }) => {
    assert.equal(new TranscodeTransformer(transcode({ status: 'PENDING' })).toObject().progress, 0)
    assert.equal(
      new TranscodeTransformer(transcode({ status: 'COMPLETED' })).toObject().progress,
      100
    )
  })

  test('a live progress value overrides — including 0', ({ assert }) => {
    assert.equal(
      new TranscodeTransformer(transcode({ status: 'PROCESSING' }), 42).toObject().progress,
      42
    )
    assert.equal(
      new TranscodeTransformer(transcode({ status: 'PROCESSING' }), 0).toObject().progress,
      0
    )
  })

  test('coerces unset nullable columns to null (never undefined)', ({ assert }) => {
    const out = new TranscodeTransformer(transcode({ id: 'x', status: 'PENDING' })).toObject()
    assert.isNull(out.outputPlaylist)
    assert.isNull(out.error)
  })
})
