import env from '#start/env'
import { S3Client } from '@aws-sdk/client-s3'

/**
 * RustFS is the S3-compatible object store that is **both** the serving origin
 * of the HLS output (served through Caddy) and the home of the FLAC archive
 * (ADR-0004). `forcePathStyle` is required for RustFS/MinIO-style endpoints.
 */
export const rustfsClient = new S3Client({
  endpoint: env.get('RUSTFS_ENDPOINT'),
  region: env.get('RUSTFS_REGION', 'us-east-1'),
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.get('RUSTFS_ACCESS_KEY'),
    secretAccessKey: env.get('RUSTFS_SECRET_KEY'),
  },
})

export const rustfsBucket = env.get('RUSTFS_BUCKET')
