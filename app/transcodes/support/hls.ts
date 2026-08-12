import app from '@adonisjs/core/services/app'
import { join } from 'node:path'

/** One AAC-LC quality of the HLS output (see CONTEXT.md, ADR-0001). */
export interface Rendition {
  name: string
  bitrate: string
}

/**
 * The fixed 3-rung ladder. 64 kbps is the floor — below it worship music
 * degrades audibly (see the design, Q7).
 */
export const RENDITIONS: readonly Rendition[] = [
  { name: 'low', bitrate: '64k' },
  { name: 'mid', bitrate: '128k' },
  { name: 'high', bitrate: '192k' },
]

/** Target segment length in seconds. */
export const HLS_SEGMENT_SECONDS = 6

/** Local staging root for a Transcode's HLS output and FLAC archive. */
export function hlsOutputDir(id: string): string {
  return app.makePath('storage/hls', id)
}

/** The master playlist on local disk — its presence marks "already encoded". */
export function masterPlaylistPath(id: string): string {
  return join(hlsOutputDir(id), 'master.m3u8')
}

/** The lossless audio archive (FLAC) on local disk, pushed to RustFS in jalon G. */
export function archivePath(id: string): string {
  return join(hlsOutputDir(id), 'archive.flac')
}

/**
 * The client-facing playlist URL stored on the Transcode. Caddy maps `/hls/*`
 * to the served origin (local now, RustFS from jalon G) — the URL is stable.
 */
export function outputPlaylistUrl(id: string): string {
  return `/hls/${id}/master.m3u8`
}
