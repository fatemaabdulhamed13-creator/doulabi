'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ListingState = { error: string } | null

export async function createListingAction(
  _prevState: ListingState,
  formData: FormData
): Promise<ListingState> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'يجب تسجيل الدخول أولاً.' }

  const title             = String(formData.get('title')           ?? '').trim()
  const price             = Number(formData.get('price')           ?? 0)
  const category          = String(formData.get('category')        ?? '').trim()
  const brand             = String(formData.get('brand')           ?? '').trim()
  const size_type         = String(formData.get('size_type')       ?? '').trim()
  const size_value        = String(formData.get('size_value')      ?? '').trim()
  const condition         = String(formData.get('condition')       ?? '').trim()
  const description       = String(formData.get('description')     ?? '').trim() || null
  const is_open_to_offers  = formData.get('is_open_to_offers')  === 'true'
  const delivery_available = formData.get('delivery_available') === 'true'
  const color              = String(formData.get('color') ?? '').trim() || null
  const city               = String(formData.get('city')  ?? '').trim() || null

  if (!title || !category || !brand || !size_value || !condition) {
    return { error: 'يرجى تعبئة جميع الحقول المطلوبة.' }
  }

  // ── Upload images ─────────────────────────────────────────────────────────

  const files = (formData.getAll('images') as File[]).filter((f) => f.size > 0)
  const image_urls: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const path = `${user.id}/${Date.now()}-${i}.webp`

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
      description,
      is_open_to_offers,
      delivery_available,
      color,
      city,
      image_urls,
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
