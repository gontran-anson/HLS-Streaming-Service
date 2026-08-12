import { test } from '@japa/runner'
import { createHmac } from 'node:crypto'
import { webhookSignature } from '#transcodes/support/deliver_webhook'

test.group('webhookSignature', () => {
  test('is the sha256=<hex> HMAC of the exact body', ({ assert }) => {
    const secret = 'testsecret'
    const body = '{"id":"0191","status":"COMPLETED"}'
    const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
    assert.equal(webhookSignature(secret, body), expected)
  })

  test('changes when the body changes (tamper-evident)', ({ assert }) => {
    const secret = 'testsecret'
    assert.notEqual(webhookSignature(secret, '{"a":1}'), webhookSignature(secret, '{"a":2}'))
  })

  test('changes when the secret changes', ({ assert }) => {
    const body = '{"a":1}'
    assert.notEqual(webhookSignature('secret-a', body), webhookSignature('secret-b', body))
  })
})
