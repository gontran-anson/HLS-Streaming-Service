import env from '#start/env'
import { defineConfig } from '@adonisjs/transmit'
import { redis } from '@adonisjs/transmit/transports/redis'

/**
 * Server-Sent-Events transport for the real-time Transcode status push (jalon F,
 * #6). Clients subscribe on the HTTP server; the payload is broadcast on the
 * per-resource channel `transcodes/<id>` (see CONTEXT.md).
 *
 * The encode runs in a **separate process** (`node ace transcode:work`) from the
 * HTTP server the SSE clients connect to, so broadcasting is routed through the
 * existing Redis (127.0.0.1:6379) as a pub/sub transport: a push from the worker
 * fans out to every server instance and reaches the subscribed clients. Without
 * this transport a worker broadcast would stay local to the worker process and
 * never be delivered.
 */
export default defineConfig({
  // No keep-alive heartbeat: a transcode is short-lived and emits frequent
  // progress pushes, so a dead connection surfaces quickly on its own.
  pingInterval: false,

  transport: {
    driver: redis({
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      // Empty string in .env means "no auth" — don't send an empty AUTH.
      password: env.get('REDIS_PASSWORD') || undefined,
    }),
  },
})
