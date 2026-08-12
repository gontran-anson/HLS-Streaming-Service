import { test } from '@japa/runner'
import { bearerToken } from '#common/utils/bearer_token'

type Request = Parameters<typeof bearerToken>[0]

/** Minimal request stub exposing only what `bearerToken` reads. */
function request(header: string | undefined): Request {
  return { header: () => header } as unknown as Request
}

test.group('bearerToken', () => {
  test('extracts the token from a Bearer header', ({ assert }) => {
    assert.equal(bearerToken(request('Bearer abc123')), 'abc123')
  })

  test('null when the header is absent', ({ assert }) => {
    assert.isNull(bearerToken(request(undefined)))
  })

  test('null when the scheme is not Bearer', ({ assert }) => {
    assert.isNull(bearerToken(request('Basic abc123')))
  })

  test('null when the token is empty', ({ assert }) => {
    assert.isNull(bearerToken(request('Bearer   ')))
  })
})
