import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET } from '@/lib/r2'

const PRESIGN_EXPIRES_SECONDS = 900 // 15 minutes
const ALLOWED_CONTENT_TYPES   = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

/**
 * Resolves the authenticated user id from either a browser session cookie
 * (web app) or an `Authorization: Bearer <access_token>` header (mobile app,
 * which has no browser cookie jar to rely on).
 */
async function getAuthedUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    const anon = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await anon.auth.getUser(token)
    return error ? null : data.user?.id ?? null
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Force Node.js runtime (not Edge) — required for Buffer and AWS SDK */
export const runtime    = 'nodejs'
export const dynamic    = 'force-dynamic'
export const maxDuration = 60

/** POST /api/upload-raw  (multipart/form-data — field name: "file")
 *  Accepts a pre-compressed image from the browser, uploads it directly to R2
 *  from the server (no browser→R2 CORS required), and returns { key }.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let formData: FormData
    try {
      formData = await req.formData()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[upload-raw POST] formData parse failed:', msg)
      return NextResponse.json({ error: `Form parse error: ${msg}` }, { status: 400 })
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided (field name must be "file")' }, { status: 400 })
    }

    console.log(`[upload-raw POST] file: ${file.name}, size: ${file.size}, type: ${file.type}`)

    const contentType = file.type || 'image/webp'
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/jpeg' ? 'jpg' : 'webp'
    const uid = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    const key = `raw/${user.id}/${uid}.${ext}`

    const buffer = await file.arrayBuffer()
    console.log(`[upload-raw POST] buffer size: ${buffer.byteLength}, key: ${key}`)

    await r2.send(new PutObjectCommand({
      Bucket:        R2_BUCKET,
      Key:           key,
      Body:          Buffer.from(buffer),
      ContentType:   contentType,
      ContentLength: buffer.byteLength,
    }))

    console.log(`[upload-raw POST] ✓ uploaded ${key}`)
    return NextResponse.json({ key })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[upload-raw POST] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** GET /api/upload-raw?filename=photo.jpg&contentType=image/jpeg
 *  Returns { presignedUrl, key } — the primary upload path for the mobile app,
 *  which uploads directly to R2 with this URL instead of proxying bytes
 *  through this server (kept for web SellForm compatibility too).
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId(req)
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
  const key     = `raw/${userId}/${uid}.${safeExt}`

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

  if (!key.startsWith(`raw/${user.id}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[upload-raw DELETE]', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
