'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import sharp from 'sharp'
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { r2, R2_BUCKET, r2PublicUrl } from '@/lib/r2'
import {
  publishListingSchema,
  draftListingSchema,
} from '@/lib/listingSchema'

export type ListingState = { error: string } | null

/** Path prefix the client uses for raw, pre-processed uploads in R2. */
const RAW_PREFIX = 'raw/'

/** Server-side compression target (matches old client-side settings). */
const MAX_DIMENSION = 1200
const WEBP_QUALITY  = 80

export async function createListingAction(
  _prevState: ListingState,
  formData: FormData,
): Promise<ListingState> {
  let shouldRedirect = false

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'يجب تسجيل الدخول أولاً.' }

    // ── Determine intent: publish (live listing) vs. draft ────────────────
    const isDraft = formData.get('intent') === 'draft'

    // ── Collect the raw-upload paths produced by the browser ──────────────
    const rawPaths = formData
      .getAll('raw_paths')
      .map((v) => String(v).trim())
      .filter((p) => p.startsWith(`${RAW_PREFIX}${user.id}/`))

    // ── Parse & validate form fields with Zod ─────────────────────────────
    const rawData = {
      title:              String(formData.get('title')        ?? '').trim(),
      price:              formData.get('price'),
      category:           String(formData.get('category')    ?? '').trim(),
      brand:              String(formData.get('brand')        ?? '').trim(),
      size_type:          String(formData.get('size_type')   ?? '').trim(),
      size_value:         String(formData.get('size_value')  ?? '').trim(),
      condition:          String(formData.get('condition')   ?? '').trim(),
      description:        String(formData.get('description') ?? '').trim() || undefined,
      is_open_to_offers:  formData.get('is_open_to_offers')  === 'true',
      delivery_available: formData.get('delivery_available') === 'true',
      color:              String(formData.get('color') ?? '').trim() || undefined,
      city:               String(formData.get('city')  ?? '').trim() || undefined,
      subcategory:        String(formData.get('subcategory') ?? '').trim() || undefined,
      imageCount:         rawPaths.length,
    }

    const schema = isDraft ? draftListingSchema : publishListingSchema
    const parsed = schema.safeParse(rawData)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'يرجى تعبئة جميع الحقول المطلوبة.'
      return { error: firstError }
    }

    const {
      title, price, category, brand, size_type, size_value, condition,
      description, is_open_to_offers, delivery_available, color, city, subcategory,
    } = parsed.data

    // ── Service-role check — fail loud rather than crashing on a null env ─
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'تكوين الخادم غير مكتمل (مفتاح الخدمة مفقود).' }
    }

    // ── Process images in parallel ────────────────────────────────────────
    // Sequential processing was risking Vercel's 10-second function timeout
    // on listings with 5+ photos. Parallel keeps total time bounded by the
    // single-slowest image instead of the sum.
    const results = await Promise.all(
      rawPaths.map((rawPath, i) => processOneImage(user.id, rawPath, i)),
    )

    const firstError = results.find((r) => 'error' in r) as { error: string } | undefined
    if (firstError) return { error: firstError.error }

    const image_urls = results.map((r) => (r as { url: string }).url)

    // ── Insert product ────────────────────────────────────────────────────
    const status = isDraft ? 'draft' : 'pending'

    const { error: insertError } = await supabase
      .from('products')
      .insert({
        seller_id: user.id,
        title,
        price,
        category,
        brand,
        size_type,
        size_value,
        condition,
        description: description ?? null,
        is_open_to_offers,
        delivery_available,
        color:       color       ?? null,
        city:        city        ?? null,
        subcategory: subcategory ?? null,
        image_urls,
        status,
      })

    if (insertError) return { error: `تعذّر إنشاء الإعلان: ${insertError.message}` }

    // Purge storefront caches so the new listing appears immediately.
    // These are no-ops for draft listings but harmless.
    revalidatePath('/')
    revalidatePath('/search')

    shouldRedirect = true
  } catch (err) {
    console.error('[createListingAction] unhandled error:', err)
    const detail = err instanceof Error ? err.message : String(err)
    return { error: `حدث خطأ غير متوقع: ${detail}` }
  }

  // redirect() throws internally — must run OUTSIDE the try/catch.
  if (shouldRedirect) redirect('/profile?listing_posted=1')
  return null
}

/**
 * Download raw from R2 → Sharp resize/WebP → upload WebP to R2 → delete raw.
 * Returns the public URL of the processed image or an Arabic error message.
 */
async function processOneImage(
  userId: string,
  rawPath: string,
  index: number,
): Promise<{ url: string } | { error: string }> {
  // 1. Download raw bytes from R2.
  let inputBuffer: Buffer
  try {
    const response = await r2.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: rawPath }),
    )
    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    inputBuffer = Buffer.concat(chunks)
  } catch (err) {
    return {
      error: `تعذّر قراءة الصورة رقم ${index + 1} من التخزين: ${
        err instanceof Error ? err.message : 'unknown'
      }`,
    }
  }

  // 2. Resize + encode to WebP. EXIF/GPS stripped by default; .rotate() first
  //    so we honour orientation BEFORE the metadata is dropped.
  let outputBuffer: Buffer
  try {
    outputBuffer = await sharp(inputBuffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()
  } catch (err) {
    return {
      error: `تعذّر معالجة الصورة رقم ${index + 1}: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }

  // 3. Upload processed WebP to R2.
  const finalPath = `${userId}/${cryptoRandomId()}.webp`
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket:      R2_BUCKET,
        Key:         finalPath,
        Body:        outputBuffer,
        ContentType: 'image/webp',
      }),
    )
  } catch (err) {
    return {
      error: `فشل رفع الصورة رقم ${index + 1}: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }

  // 4. Clean up raw temp — non-fatal if it fails.
  r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: rawPath })).catch(() => { /* ignore */ })

  return { url: r2PublicUrl(finalPath) }
}

/** Short random id for object names. */
function cryptoRandomId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

/* ── Seller actions ──────────────────────────────────────────────────────── */

export async function markAsSoldAction(productId: string, _?: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/')

  const { error } = await supabase
    .from('products')
    .update({ is_sold: true })
    .eq('id', productId)
    .eq('seller_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/profile')
  revalidatePath('/')
  revalidatePath('/search')
}

/* ── Admin helpers ───────────────────────────────────────────────────────── */

async function requireAdmin() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  return supabase
}

export async function approveProductAction(productId: string, _?: FormData) {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('products')
    .update({ status: 'approved' })
    .eq('id', productId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/search')
}

export async function approveProductWithImagesAction(
  productId: string,
  imageUrls: string[],
  category: string,
  brand: string,
) {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('products')
    .update({ status: 'approved', image_urls: imageUrls, category, brand })
    .eq('id', productId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/search')
}

export async function rejectProductAction(productId: string, _?: FormData) {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('products')
    .update({ status: 'rejected' })
    .eq('id', productId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/search')
}
