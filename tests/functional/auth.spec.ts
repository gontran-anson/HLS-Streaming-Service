import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { TokenVerifier } from '#common/services/token_verifier'

const KNOWN_ID = '0191ffff-0000-7000-8000-000000000000'

/** Swaps the delegated verifier so tests never hit the network. */
function verifierReturns(value: boolean) {
  app.container.swap(TokenVerifier, () => {
    return { verify: async () => value } as unknown as TokenVerifier
  })
}

test.group('Auth gate', (group) => {
  group.each.teardown(() => app.container.restore(TokenVerifier))

  test('POST /upload without a token is 401', async ({ client }) => {
    const response = await client.post('/upload')
    response.assertStatus(401)
  })

  test('GET status without a token is 401', async ({ client }) => {
    const response = await client.get(`/transcodes/${KNOWN_ID}/status`)
    response.assertStatus(401)
  })

  test('POST /transcodes without a token is 401', async ({ client }) => {
    const response = await client.post('/transcodes').json({ sourceUrl: 'https://x/y.mp3' })
    response.assertStatus(401)
  })

  test('DELETE /transcodes/:id without a token is 401', async ({ client }) => {
    const response = await client.delete(`/transcodes/${KNOWN_ID}`)
    response.assertStatus(401)
  })

  test('an invalid token is 401 (verifier rejects)', async ({ client }) => {
    verifierReturns(false)
    const response = await client
      .get(`/transcodes/${KNOWN_ID}/status`)
      .header('Authorization', 'Bearer nope')
    response.assertStatus(401)
  })
})
