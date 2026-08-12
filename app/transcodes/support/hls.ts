import env from '#start/env'
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

/**
 * The lossless audio archive (FLAC) on local disk, pushed to RustFS in jalon G.
 * Kept **outside** the HLS output dir so it is never swept into the HLS upload
 * — the archive is conservation, not diffusion.
 */
export function archivePath(id: string): string {
  return app.makePath('storage/archives', `${id}.flac`)
}

/**
 * The client-facing playlist URL stored on the Transcode and published in every
 * channel. **Absolute** (ADR-0006): `<HLS_PUBLIC_BASE_URL>/hls/<id>/master.m3u8`.
 * The base is the public front door (Caddy/CDN), not the internal RustFS origin;
 * the service says *where*, so callers never recompose the path.
 */
export function outputPlaylistUrl(id: string): string {
  const base = env.get('HLS_PUBLIC_BASE_URL').replace(/\/+$/, '')
  return `${base}/hls/${id}/master.m3u8`
}
