/**
 * A source that carries no decodable audio track — a **permanent** failure
 * (see the design, Q9). The worker turns this into a non-retryable job so it
 * fails once, immediately, instead of re-probing the same silent file N times.
 */
export class NoAudioTrackException extends Error {
  constructor() {
    super('The source has no decodable audio track')
    this.name = 'NoAudioTrackException'
  }
}
