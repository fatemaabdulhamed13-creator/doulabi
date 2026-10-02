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

// The bucket was first served from its r2.dev address; listings saved before the move to the
// custom domain (NEXT_PUBLIC_R2_PUBLIC_URL) still store those URLs.
const LEGACY_R2_PUBLIC_URL = "https://pub-8f4065c3efc2429a8696ab412bf33229.r2.dev"

/** The R2 object key behind a public URL on either address, or null if it isn't one of ours. */
export function r2KeyFromPublicUrl(url: string): string | null {
  const base = [process.env.NEXT_PUBLIC_R2_PUBLIC_URL, LEGACY_R2_PUBLIC_URL]
    .filter((b): b is string => !!b)
    .map((b) => b.replace(/\/$/, ''))
    .find((b) => url.startsWith(`${b}/`))
  return base ? url.slice(base.length + 1) : null
}

/** Construct a public URL for an R2 object key. */
export function r2PublicUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, '')
  return `${base}/${key}`
}
