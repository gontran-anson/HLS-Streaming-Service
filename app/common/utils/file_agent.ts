export const getExtension = (fileName: string): string => {
  return (fileName.split('.').at(-1) ?? '').split('?').at(0) ?? ''
}

export const contentType = (fileName: string): string => {
  return (
    {
      mp4: 'video/mp4',
      mkv: 'video/x-matroska',
      mov: 'video/quicktime',
      webm: 'video/webm',
      avi: 'video/x-msvideo',
      wmv: 'video/x-ms-wmv',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      ogg: 'audio/ogg',
      wav: 'audio/wav',
      flac: 'audio/x-flac',
      webp: 'image/webp',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
    }[getExtension(fileName)] ?? 'application/octet-stream'
  )
}

export const fileKind = (fileName: string): 'video' | 'audio' | 'image' | 'other' => {
  const ext = getExtension(fileName)

  return (
    ({
      mp4: 'video',
      mkv: 'video',
      mov: 'video',
      webm: 'video',
      avi: 'video',
      wmv: 'video',
      mp3: 'audio',
      m4a: 'audio',
      aac: 'audio',
      ogg: 'audio',
      wav: 'audio',
      flac: 'audio',
      webp: 'image',
      png: 'image',
      jpg: 'image',
      jpeg: 'image',
      gif: 'image',
    }[ext] as 'video' | 'audio' | 'image' | 'other') ?? 'other'
  )
}
