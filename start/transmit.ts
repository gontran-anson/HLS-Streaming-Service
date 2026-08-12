import transmit from '@adonisjs/transmit/services/main'

/**
 * Registers Transmit's SSE endpoints (`__transmit/events`, `__transmit/subscribe`,
 * `__transmit/unsubscribe`) — the client-facing side of the real-time status push
 * (jalon F, #6).
 *
 * The `transcodes/<id>` channel is left **open** (no `transmit.authorize(...)`),
 * consistent with the currently-open transcode routes; token auth lands in jalon H
 * (#8) and will gate this channel then.
 */
transmit.registerRoutes()
