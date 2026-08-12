/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for the Redis-backed BullMQ transcode queue
  |----------------------------------------------------------
  */
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),
  WORKER_CONCURRENCY: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Delegated token verification (ADR-0003)
  |----------------------------------------------------------
  */
  AUTH_VERIFY_URL: Env.schema.string({ format: 'url', tld: false }),
  AUTH_VERIFY_METHOD: Env.schema.enum.optional(['GET', 'POST'] as const),
  AUTH_VERIFY_STATUS: Env.schema.number.optional(),
  AUTH_VERIFY_BODY_MATCH: Env.schema.string.optional(),
  AUTH_CACHE_TTL: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | RustFS (S3-compatible) — HLS serving origin + FLAC archive
  |----------------------------------------------------------
  */
  RUSTFS_ENDPOINT: Env.schema.string({ format: 'url', tld: false }),
  RUSTFS_REGION: Env.schema.string.optional(),
  RUSTFS_ACCESS_KEY: Env.schema.string(),
  RUSTFS_SECRET_KEY: Env.schema.string(),
  RUSTFS_BUCKET: Env.schema.string(),
})
