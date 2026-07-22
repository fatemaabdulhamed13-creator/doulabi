import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET } from '@/lib/r2'

const PRESIGN_EXPIRES_SECONDS = 900 // 15 minutes
const ALLOWED_CONTENT_TYPES   = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

/** GET /api/upload-raw?filename=photo.jpg&contentType=image/jpeg
 *  Returns { presignedUrl, key } so the client can PUT directly to R2.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const filename    = req.nextUrl.searchParams.get('filename') ?? 'image.jpg'
  const contentType = req.nextUrl.searchParams.get('contentType') ?? 'image/jpeg'

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
  }

  // Derive safe extension from original filename
  const ext     = (filename.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext) ? ext : 'jpg'
  const uid     = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const key     = `raw/${user.id}/${uid}.${safeExt}`

  const command = new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         key,
    ContentType: contentType,
  })

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: PRESIGN_EXPIRES_SECONDS })

  return NextResponse.json({ presignedUrl, key })
}

/** DELETE /api/upload-raw?key=raw/userId/abc123.jpg
 *  Cleans up an abandoned raw upload from R2.
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = req.nextUrl.searchParams.get('key')
  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 })
  }

  // Security: ensure the key belongs to the authenticated user
  if (!key.startsWith(`raw/${user.id}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[upload-raw DELETE]', err)
    // Non-fatal — caller treats cleanup as best-effort
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
