import { test } from '@japa/runner'
import { archiveKey, hlsKeyPrefix, outputPlaylistUrl } from '#transcodes/support/hls'

test.group('outputPlaylistUrl', () => {
  test('is an absolute URL ending at /hls/<id>/master.m3u8 (ADR-0006)', ({ assert }) => {
    const url = outputPlaylistUrl('abc-123')
    assert.match(url, /^https?:\/\//)
    assert.isTrue(url.endsWith('/hls/abc-123/master.m3u8'))
    // no accidental double slash after the scheme, whatever the base's trailing slash
    assert.notInclude(url.replace(/^https?:\/\//, ''), '//')
  })
})

test.group('RustFS keys', () => {
  test('the published playlist lives under the HLS key prefix', ({ assert }) => {
    // The delete aims at this prefix; if it ever drifted from the URL the
    // service publishes, a deletion would leave servable bytes behind.
    assert.isTrue(outputPlaylistUrl('abc-123').endsWith(`${hlsKeyPrefix('abc-123')}/master.m3u8`))
  })

  test('the archive key is derived from the id alone', ({ assert }) => {
    assert.equal(archiveKey('abc-123'), 'archives/abc-123.flac')
  })
})
