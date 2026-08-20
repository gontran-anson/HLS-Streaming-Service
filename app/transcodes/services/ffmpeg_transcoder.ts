import {
  RENDITIONS,
  HLS_SEGMENT_SECONDS,
  hlsOutputDir,
  archivePath,
  downloadOutputDir,
  downloadOutputArgs,
  downloadRenditionPath,
} from '#transcodes/support/hls'
import { execFile, spawn } from 'node:child_process'
import { mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ProbeResult {
  /** Media duration in seconds, or `null` when ffprobe exposes none (Q16). */
  durationSeconds: number | null
  /** Whether the container carries at least one decodable audio track. */
  hasAudio: boolean
}

/**
 * One progressive download rendition produced by the pass (ADR-0009), with its
 * **byte size measured locally before upload**. The caller (issue #186) needs the
 * exact size for the client's progress bar, resume validation and disk pre-check,
 * and a `HEAD` round-trip per file is the thing we are avoiding — so the encoder
 * hands the sizes up rather than making the caller ask RustFS.
 *
 * `name` matches a `Rendition.name` (`low`/`mid`/`high`), so #186 pairs each size
 * with its public URL via `downloadRenditionUrl(id, name)`.
 */
export interface DownloadRendition {
  name: string
  bitrate: string
  bytes: number
}

/** What one encode pass produced besides the HLS (returned for issue #186). */
export interface EncodeResult {
  downloads: DownloadRendition[]
}

/**
 * Thin wrapper over the system `ffprobe`/`ffmpeg` binaries (see the design, Q7/Q8).
 *
 * The encode is a **single** ffmpeg invocation reading the source once and
 * writing, from that one read: the FLAC archive (upload path only), the three
 * HLS renditions with a master playlist, and the three progressive `.aac`
 * download renditions (ADR-0009) — so `-progress`'s `out_time_us` runs
 * 0→duration exactly once and the percentage formula holds. Video is discarded
 * (`-vn`, ADR-0001).
 */
export class FfmpegTranscoder {
  async probe(sourcePath: string): Promise<ProbeResult> {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=codec_type',
      '-of',
      'json',
      sourcePath,
    ])

    const data = JSON.parse(stdout) as {
      streams?: { codec_type?: string }[]
      format?: { duration?: string }
    }

    const hasAudio = (data.streams ?? []).some((stream) => stream.codec_type === 'audio')
    const duration = data.format?.duration ? Number(data.format.duration) : Number.NaN

    return { hasAudio, durationSeconds: Number.isFinite(duration) ? duration : null }
  }

  /**
   * Encodes the source (a local path or a remote URL — ffmpeg reads both) into
   * local HLS **and** the three progressive `.aac` download renditions (ADR-0009,
   * produced on both ingestion paths — they are a serving artefact, not an
   * archival one). When `withArchive` is true it also writes the lossless FLAC
   * master; a URL ingestion sets it false (the original already lives at the URL,
   * ADR-0004). `onProgress` gets an integer percentage (0-99) as ffmpeg advances;
   * it is not called when the duration is unknown.
   *
   * Returns the download renditions with their **locally measured byte sizes**,
   * so the caller (#186) can persist and publish them without a `HEAD` per file.
   */
  async encode(
    source: string,
    id: string,
    durationSeconds: number | null,
    onProgress: (percent: number) => void,
    options: { withArchive: boolean } = { withArchive: true }
  ): Promise<EncodeResult> {
    const outDir = hlsOutputDir(id)
    await mkdir(outDir, { recursive: true })
    for (const rendition of RENDITIONS) {
      await mkdir(join(outDir, rendition.name), { recursive: true })
    }
    // The `.aac` download renditions live outside the HLS dir (see hls.ts) so the
    // HLS upload never sweeps them — ensure their staging dir exists.
    await mkdir(downloadOutputDir(id), { recursive: true })
    if (options.withArchive) {
      // The FLAC archive lives outside the HLS dir (see hls.ts) — ensure its dir exists.
      await mkdir(dirname(archivePath(id)), { recursive: true })
    }

    const args = this.buildArgs(source, id, outDir, options.withArchive)

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', args)

      let stderrTail = ''
      proc.stderr.on('data', (chunk) => {
        stderrTail = (stderrTail + chunk.toString()).slice(-2000)
      })

      let buffer = ''
      proc.stdout.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const match = line.match(/^out_time_us=(\d+)/)
          if (match && durationSeconds) {
            const percent = Math.min(
              99,
              Math.floor((Number(match[1]) / (1_000_000 * durationSeconds)) * 100)
            )
            if (percent >= 0) onProgress(percent)
          }
        }
      })

      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderrTail}`))
      })
    })

    return { downloads: await this.measureDownloads(id) }
  }

  /**
   * Stats the three `.aac` renditions on disk and reports their byte sizes
   * (ADR-0009). Split from `encode` so a retry that finds the HLS already staged
   * (the checkpoint in ProcessTranscode) can still recover the sizes without
   * re-encoding — the `.aac` were written in the same pass and are still there.
   */
  async measureDownloads(id: string): Promise<DownloadRendition[]> {
    return Promise.all(
      RENDITIONS.map(async (rendition) => {
        const { size } = await stat(downloadRenditionPath(id, rendition.name))
        return { name: rendition.name, bitrate: rendition.bitrate, bytes: size }
      })
    )
  }

  private buildArgs(source: string, id: string, outDir: string, withArchive: boolean): string[] {
    const bitrateFlags = RENDITIONS.flatMap((rendition, index) => [
      `-b:a:${index}`,
      rendition.bitrate,
    ])
    const streamMap = RENDITIONS.map(
      (rendition, index) => `a:${index},name:${rendition.name}`
    ).join(' ')

    return [
      '-hide_banner',
      '-y',
      '-i',
      source,
      '-vn',
      '-progress',
      'pipe:1',
      '-nostats',
      // Output 1 — lossless FLAC archive (skipped for a URL source: the original
      // already lives at the URL, ADR-0004).
      ...(withArchive ? ['-map', '0:a:0', '-c:a', 'flac', archivePath(id)] : []),
      // Output 2 — the three HLS renditions + master playlist.
      ...RENDITIONS.flatMap(() => ['-map', '0:a:0']),
      '-c:a',
      'aac',
      ...bitrateFlags,
      '-f',
      'hls',
      '-hls_time',
      String(HLS_SEGMENT_SECONDS),
      '-hls_playlist_type',
      'vod',
      '-hls_flags',
      'independent_segments',
      '-master_pl_name',
      'master.m3u8',
      '-var_stream_map',
      streamMap,
      '-hls_segment_filename',
      join(outDir, '%v', 'seg_%03d.ts'),
      join(outDir, '%v', 'index.m3u8'),
      // Outputs 3-5 — the three progressive `.aac` download renditions, mapped
      // from the same source read (no second decode). Produced on both ingestion
      // paths: they are a serving artefact, not an archive (ADR-0009).
      ...downloadOutputArgs(id),
    ]
  }
}
