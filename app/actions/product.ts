'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  publishListingSchema,
  draftListingSchema,
  ACCEPTED_IMAGE_TYPES,
  MAX_RAW_FILE_SIZE_BYTES,
} from '@/lib/listingSchema'

export type ListingState = { error: string } | null

export async function createListingAction(
  _prevState: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'يجب تسجيل الدخول أولاً.' }

  // ── Determine intent: publish (live listing) vs. draft ────────────────────
  const isDraft = formData.get('intent') === 'draft'

  // ── Collect & pre-flight-check raw files ─────────────────────────────────
  const files = (formData.getAll('images') as File[]).filter((f) => f.size > 0)

  for (const file of files) {
    // Server-side file-type guard (second layer after client validation)
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      return { error: 'نوع الملف غير مدعوم. يُقبل: JPEG، PNG، WebP فقط.' }
    }
    // Server-side size guard (images must already be compressed, but keep the cap)
    if (file.size > MAX_RAW_FILE_SIZE_BYTES) {
      return { error: 'حجم الصورة كبير جداً. الحد الأقصى 15 ميغابايت لكل صورة.' }
    }
  }

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
    imageCount:         files.length,
  }

  // Drafts allow 0 images; published listings require ≥ 3.
  const schema = isDraft ? draftListingSchema : publishListingSchema
  const parsed = schema.safeParse(rawData)

  if (!parsed.success) {
    // Return the first validation error in Arabic.
    const firstError = parsed.error.issues[0]?.message ?? 'يرجى تعبئة جميع الحقول المطلوبة.'
    return { error: firstError }
  }

  const {
    title, price, category, brand, size_type, size_value, condition,
    description, is_open_to_offers, delivery_available, color, city,
  } = parsed.data

  // ── Upload images ─────────────────────────────────────────────────────────
  const image_urls: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    // Use the clean .webp filename produced by the client compression utility.
    // Fall back to a timestamp-based name if the file somehow lacks one.
    const safeName =
      file.name?.replace(/[^a-zA-Z0-9_.-]/g, '_') || `${Date.now()}-${i}.webp`
    const path = `${user.id}/${i}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, file, { contentType: 'image/webp', upsert: false })

    if (uploadError) return { error: `فشل رفع الصورة: ${uploadError.message}` }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(path)

    image_urls.push(publicUrl)
  }

  // ── Insert product ────────────────────────────────────────────────────────
  // Drafts are stored with status='draft'; published listings use 'pending' (admin review).
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
      color: color ?? null,
      city:  city  ?? null,
      image_urls,
      status,
    })

  if (insertError) return { error: insertError.message }

  redirect('/profile?listing_posted=1')
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
