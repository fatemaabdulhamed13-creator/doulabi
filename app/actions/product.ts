'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  publishListingSchema,
  draftListingSchema,
} from '@/lib/listingSchema'

export type ListingState = { error: string } | null

/** Bucket where temp raw uploads and final processed images both live. */
const STORAGE_BUCKET = 'product-images'

/** Path prefix the client uses for raw, pre-processed uploads. */
const RAW_PREFIX = 'raw/'

/** Server-side compression target (matches old client-side settings). */
const MAX_DIMENSION = 1200
const WEBP_QUALITY  = 80

export async function createListingAction(
  _prevState: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'يجب تسجيل الدخول أولاً.' }

  // ── Determine intent: publish (live listing) vs. draft ────────────────────
  const isDraft = formData.get('intent') === 'draft'

  // ── Collect the raw-upload paths produced by the browser ─────────────────
  const rawPaths = formData
    .getAll('raw_paths')
    .map((v) => String(v).trim())
    .filter((p) => p.startsWith(`${RAW_PREFIX}${user.id}/`))

  // ── Parse & validate form fields with Zod ────────────────────────────────
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

  // Drafts allow 0 images; published listings require ≥ 3.
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

  // ── Server-side image processing ──────────────────────────────────────────
  // We use the admin client for download/process/upload/cleanup so we can
  // bypass RLS (which has no delete policy) without forcing the user to send
  // huge raw files through a Vercel function body limit.
  const admin = createAdminClient()
  const image_urls: string[] = []

  for (let i = 0; i < rawPaths.length; i++) {
    const rawPath = rawPaths[i]

    // 1. Download the raw bytes the browser uploaded to temp.
    const { data: rawBlob, error: dlError } = await admin.storage
      .from(STORAGE_BUCKET)
      .download(rawPath)

    if (dlError || !rawBlob) {
      return { error: `تعذّر قراءة الصورة من التخزين: ${dlError?.message ?? 'unknown'}` }
    }

    const inputBuffer = Buffer.from(await rawBlob.arrayBuffer())

    // 2. Resize + encode to WebP via Sharp. EXIF/GPS metadata is stripped by default.
    let outputBuffer: Buffer
    try {
      outputBuffer = await sharp(inputBuffer, { failOn: 'none' })
        .rotate() // honour EXIF orientation before stripping
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
        error: `تعذّر معالجة الصورة رقم ${i + 1}: ${err instanceof Error ? err.message : 'unknown'}`,
      }
    }

    // 3. Upload the processed WebP to the user's final folder.
    const finalPath = `${user.id}/${cryptoRandomId()}.webp`
    const { error: upError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(finalPath, outputBuffer, {
        contentType: 'image/webp',
        upsert: false,
      })

    if (upError) return { error: `فشل رفع الصورة: ${upError.message}` }

    const { data: { publicUrl } } = admin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(finalPath)

    image_urls.push(publicUrl)

    // 4. Clean up the raw temp file. Failure here is non-fatal — a cron can
    //    sweep orphans later — so we don't error the whole request.
    await admin.storage.from(STORAGE_BUCKET).remove([rawPath])
  }

  // ── Insert product ────────────────────────────────────────────────────────
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

  if (insertError) return { error: insertError.message }

  redirect('/profile?listing_posted=1')
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
}
