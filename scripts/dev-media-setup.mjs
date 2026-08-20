/**
 * Setup RustFS (dev) pour la chaîne média de bout en bout — à lancer une fois sur un poste neuf.
 *
 * Ce que la chaîne exige côté stockage objet, et que rien ne crée automatiquement :
 *   - le bucket **source** (`MEDIA_STORE_BUCKET`, ex. `mediatheque-source`) où le navigateur
 *     dépose le fichier source (PUT présigné multipart) et où vivent les visuels générés ;
 *   - le bucket **HLS/dl** (`RUSTFS_BUCKET`, ex. `streaming-service`) où le transcodeur pousse
 *     les rendus HLS/.aac ;
 *   - **lecture publique** sur les deux : Caddy et les visuels lisent RustFS **anonymement**
 *     (accès direct sans policy = 403 vérifié) ;
 *   - **CORS** sur le bucket source uniquement : l'upload PUT vient du navigateur (cross-origin),
 *     et le multipart a besoin que `ETag` soit exposé. Le HLS/dl, lui, passe par Caddy qui pose
 *     déjà son propre CORS — inutile (et nuisible : doublon d'`Access-Control-Allow-Origin`) de
 *     le remettre sur ce bucket.
 *
 * Rappel `.env` new-life-server (voir `.env.example`) : `MEDIA_STORE_*`, `STREAMING_SERVICE_URL`,
 * `STREAMING_SERVICE_TOKEN`, `STREAMING_CALLBACK_BASE_URL`, `REDIS_*`. Et côté streaming-service :
 * `AUTH_VERIFY_URL` doit pointer sur le verify réel de new-life-server (`/streaming/verify`).
 *
 * Usage : `RUSTFS_ENDPOINT=… RUSTFS_ACCESS_KEY=… RUSTFS_SECRET_KEY=… \
 *          SOURCE_BUCKET=mediatheque-source HLS_BUCKET=streaming-service node scripts/dev-media-setup.mjs`
 */
import {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
  DeleteBucketCorsCommand,
} from '@aws-sdk/client-s3'

const endpoint = process.env.RUSTFS_ENDPOINT ?? 'http://127.0.0.1:9000'
const region = process.env.RUSTFS_REGION ?? 'us-east-1'
const accessKeyId = process.env.RUSTFS_ACCESS_KEY
const secretAccessKey = process.env.RUSTFS_SECRET_KEY
const sourceBucket = process.env.SOURCE_BUCKET ?? 'mediatheque-source'
const hlsBucket = process.env.HLS_BUCKET ?? 'streaming-service'

if (!accessKeyId || !secretAccessKey) {
  console.error('RUSTFS_ACCESS_KEY / RUSTFS_SECRET_KEY manquants.')
  process.exit(1)
}

const s3 = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
})

const publicReadPolicy = (bucket) =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicRead',
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  })

const uploadCors = {
  CORSRules: [
    {
      AllowedOrigins: ['*'],
      AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag', 'x-amz-request-id', 'x-amz-version-id'],
      MaxAgeSeconds: 3600,
    },
  ],
}

async function ensureBucket(bucket) {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
    console.log('bucket créé   :', bucket)
  } catch (e) {
    const code = e?.name
    if (code === 'BucketAlreadyOwnedByYou' || code === 'BucketAlreadyExists') {
      console.log('bucket présent:', bucket)
    } else throw e
  }
  await s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: publicReadPolicy(bucket) }))
  console.log('  lecture publique posée')
}

await ensureBucket(sourceBucket)
await ensureBucket(hlsBucket)

// CORS : uniquement le bucket source (upload navigateur). Le HLS/dl est servi par Caddy (CORS là-bas).
await s3.send(new PutBucketCorsCommand({ Bucket: sourceBucket, CORSConfiguration: uploadCors }))
console.log('CORS upload posé sur:', sourceBucket)
try {
  await s3.send(new DeleteBucketCorsCommand({ Bucket: hlsBucket }))
  console.log('CORS retiré (doublon Caddy) de:', hlsBucket)
} catch {
  /* pas de CORS à retirer : très bien */
}

console.log('\n✓ RustFS prêt pour la chaîne média de dev.')
