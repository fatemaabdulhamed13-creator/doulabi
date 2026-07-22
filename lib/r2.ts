import { S3Client } from '@aws-sdk/client-s3'

/**
 * Singleton S3Client configured for Cloudflare R2.
 *
 * Required env vars (server-side only — never exposed to the browser):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *
 * Public read URL (safe to expose):
 *   NEXT_PUBLIC_R2_PUBLIC_URL  (e.g. https://pub-xxxx.r2.dev)
 */
export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME!

/** Construct a public URL for an R2 object key. */
export function r2PublicUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, '')
  return `${base}/${key}`
}
