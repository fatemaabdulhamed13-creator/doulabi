import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { r2, R2_BUCKET } from '@/lib/r2'

// Only serves app builds released before the switch to the Supabase `presign-upload`
// function. Delete this route once every tester/user is on a newer build.

const PRESIGN_EXPIRES_SECONDS = 900
const ALLOWED_CONTENT_TYPES   = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/upload-raw?filename=photo.jpg&contentType=image/jpeg → { presignedUrl, key } */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data, error } = await anon.auth.getUser(authHeader.slice('Bearer '.length))
  const userId = error ? null : data.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const filename    = req.nextUrl.searchParams.get('filename') ?? 'image.jpg'
  const contentType = req.nextUrl.searchParams.get('contentType') ?? 'image/jpeg'

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
  }

  const ext     = (filename.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext) ? ext : 'jpg'
  const uid     = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  // Not under raw/: the app uses this key as the listing's permanent photo, and raw/ expires after 24h.
  const key     = `${userId}/${uid}.${safeExt}`

  const command = new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType })
  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: PRESIGN_EXPIRES_SECONDS })

  return NextResponse.json({ presignedUrl, key })
}
