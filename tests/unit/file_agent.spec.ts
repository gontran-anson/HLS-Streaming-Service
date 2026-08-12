import { test } from '@japa/runner'
import { fileKind, getExtension } from '#common/utils/file_agent'

test.group('fileKind', () => {
  test('classifies accepted audio extensions', ({ assert }) => {
    for (const name of ['a.mp3', 'a.wav', 'a.flac', 'a.aac', 'a.ogg', 'a.m4a']) {
      assert.equal(fileKind(name), 'audio', name)
    }
  })

  test('classifies accepted video extensions', ({ assert }) => {
    for (const name of ['a.mp4', 'a.mkv', 'a.mov', 'a.webm', 'a.avi', 'a.wmv']) {
      assert.equal(fileKind(name), 'video', name)
    }
  })

  test('unknown extension is other', ({ assert }) => {
    assert.equal(fileKind('a.txt'), 'other')
  })
})

test.group('getExtension', () => {
  test('reads the extension from a URL, stripping the query', ({ assert }) => {
    assert.equal(getExtension('https://bucket.example.com/path/audio.mp3?X-Amz-Sig=abc'), 'mp3')
  })
})
