import { test } from '@japa/runner'
import { outputPlaylistUrl } from '#transcodes/support/hls'

test.group('outputPlaylistUrl', () => {
  test('is an absolute URL ending at /hls/<id>/master.m3u8 (ADR-0006)', ({ assert }) => {
    const url = outputPlaylistUrl('abc-123')
    assert.match(url, /^https?:\/\//)
    assert.isTrue(url.endsWith('/hls/abc-123/master.m3u8'))
    // no accidental double slash after the scheme, whatever the base's trailing slash
    assert.notInclude(url.replace(/^https?:\/\//, ''), '//')
  })
})
