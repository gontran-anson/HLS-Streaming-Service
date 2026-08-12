import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { TokenVerifier } from '#common/services/token_verifier'

/** A valid token, so requests get past auth and reach validation. */
function authed() {
  app.container.swap(TokenVerifier, () => {
    return { verify: async () => true } as unknown as TokenVerifier
  })
}

test.group('Validation', (group) => {
  group.each.setup(() => authed())
  group.each.teardown(() => app.container.restore(TokenVerifier))

  test('a malformed transcode id is 422', async ({ client }) => {
    const response = await client
      .get('/transcodes/not-a-uuid/status')
      .header('Authorization', 'Bearer ok')
    response.assertStatus(422)
  })

  test('URL ingestion without a sourceUrl is 422', async ({ client }) => {
    const response = await client.post('/transcodes').header('Authorization', 'Bearer ok').json({})
    response.assertStatus(422)
  })

  test('URL ingestion with a non-URL sourceUrl is 422', async ({ client }) => {
    const response = await client
      .post('/transcodes')
      .header('Authorization', 'Bearer ok')
      .json({ sourceUrl: 'not-a-url' })
    response.assertStatus(422)
  })
})
