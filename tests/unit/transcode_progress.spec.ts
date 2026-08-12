import { test } from '@japa/runner'
import { progressFromStatus } from '#transcodes/support/transcode_progress'

test.group('progressFromStatus', () => {
  test('PENDING is 0', ({ assert }) => {
    assert.equal(progressFromStatus('PENDING'), 0)
  })

  test('COMPLETED is 100', ({ assert }) => {
    assert.equal(progressFromStatus('COMPLETED'), 100)
  })

  test('PROCESSING is null — indeterminate without a live Redis value', ({ assert }) => {
    assert.isNull(progressFromStatus('PROCESSING'))
  })

  test('FAILED is null', ({ assert }) => {
    assert.isNull(progressFromStatus('FAILED'))
  })
})
