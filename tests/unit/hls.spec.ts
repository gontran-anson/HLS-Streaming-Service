import { test } from '@japa/runner'
import {
  DOWNLOAD_FORMAT,
  RENDITIONS,
  archiveKey,
  downloadKeyPrefix,
  downloadOutputArgs,
  downloadRenditionKey,
  downloadRenditionPath,
  downloadRenditionUrl,
  hlsKeyPrefix,
  outputPlaylistUrl,
} from '#transcodes/support/hls'

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

test.group('download renditions (ADR-0009)', () => {
  test('the key prefix versions the download renditions by transcode id', ({ assert }) => {
    // The <id> in the path makes every re-transcode a new URL, so a paused
    // download resumed later can never splice a different version's bytes.
    assert.equal(downloadKeyPrefix('abc-123'), 'dl/abc-123')
  })

  test('each rendition key is dl/<id>/<name>.aac', ({ assert }) => {
    assert.equal(downloadRenditionKey('abc-123', 'low'), 'dl/abc-123/low.aac')
    assert.equal(downloadRenditionKey('abc-123', 'high'), 'dl/abc-123/high.aac')
  })

  test('the public URL is absolute, unsigned, and under the key prefix', ({ assert }) => {
    const url = downloadRenditionUrl('abc-123', 'mid')
    assert.match(url, /^https?:\/\//)
    assert.isTrue(url.endsWith(`/${downloadRenditionKey('abc-123', 'mid')}`))
    assert.notInclude(url, '?') // unsigned — no query string that could expire mid-pause
    assert.notInclude(url.replace(/^https?:\/\//, ''), '//')
  })

  test('the download URL shares the HLS public origin', ({ assert }) => {
    const dl = downloadRenditionUrl('abc-123', 'low')
    const hls = outputPlaylistUrl('abc-123')
    const origin = (u: string) => u.slice(0, u.indexOf('/', 'https://'.length))
    assert.equal(origin(dl), origin(hls))
  })

  test('the local rendition path lives under the id, outside the HLS dir', ({ assert }) => {
    const path = downloadRenditionPath('abc-123', 'low')
    assert.isTrue(path.endsWith('/dl/abc-123/low.aac'))
    assert.notInclude(path, '/hls/')
  })

  test('the ffmpeg output args map one ADTS aac output per ladder rung', ({ assert }) => {
    const args = downloadOutputArgs('abc-123')
    // One block of 9 tokens per rendition: -map 0:a:0 -c:a aac -b:a <br> -f adts <path>
    assert.lengthOf(args, RENDITIONS.length * 9)

    for (const rendition of RENDITIONS) {
      const path = downloadRenditionPath('abc-123', rendition.name)
      const at = args.indexOf(path)
      assert.isAbove(at, -1, `${rendition.name} output present`)
      // The tokens immediately preceding the output path configure it.
      assert.deepEqual(args.slice(at - 8, at + 1), [
        '-map',
        '0:a:0',
        '-c:a',
        DOWNLOAD_FORMAT.codec,
        '-b:a',
        rendition.bitrate,
        '-f',
        DOWNLOAD_FORMAT.container,
        path,
      ])
    }
  })

  test('the format is AAC in an ADTS container (spike #183)', ({ assert }) => {
    assert.equal(DOWNLOAD_FORMAT.codec, 'aac')
    assert.equal(DOWNLOAD_FORMAT.container, 'adts')
    assert.equal(DOWNLOAD_FORMAT.extension, 'aac')
    assert.equal(DOWNLOAD_FORMAT.contentType, 'audio/aac')
  })
})
