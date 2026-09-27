'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { coreListingFields } from '@/lib/listingSchema'
import { deleteProductForUser } from '@/lib/products/deleteProduct'
import { notifySellerListingApproved } from '@/app/actions/notifications'

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

  revalidateTag('products', 'default')
  revalidatePath('/profile')
  revalidatePath('/')
  revalidatePath('/search')
}

export async function markAsAvailableAction(productId: string, _?: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/')

  const { error } = await supabase
    .from('products')
    .update({ is_sold: false })
    .eq('id', productId)
    .eq('seller_id', user.id)

  if (error) throw new Error(error.message)

  revalidateTag('products', 'default')
  revalidatePath('/profile')
  revalidatePath('/')
  revalidatePath('/search')
}

export type UpdateListingState = { error: string } | null

export async function updateProductAction(
  productId: string,
  _prevState: UpdateListingState,
  formData: FormData,
): Promise<UpdateListingState> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'يجب تسجيل الدخول أولاً.' }

    // Verify ownership before update
    const { data: existing } = await supabase
      .from('products')
      .select('seller_id')
      .eq('id', productId)
      .single()

    if (!existing || existing.seller_id !== user.id) {
      return { error: 'غير مصرح لك بتعديل هذا الإعلان.' }
    }

    // Parse editable fields. title/category/brand are editable at any
    // status now — the enforce_product_edit_rules DB trigger is what
    // actually pulls an approved listing back to "pending" if one of
    // these changes, not a block here.
    const identityFields = coreListingFields
      .pick({ title: true, category: true, brand: true })
      .safeParse({
        title:    formData.get('title'),
        category: formData.get('category'),
        brand:    formData.get('brand'),
      })
    if (!identityFields.success) {
      return { error: identityFields.error.issues[0]?.message ?? 'بيانات غير صالحة.' }
    }
    const { title, category, brand } = identityFields.data

    const price       = Number(formData.get('price'))
    const condition   = String(formData.get('condition') ?? '').trim()
    const size_value  = String(formData.get('size_value') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim() || null
    const city        = String(formData.get('city') ?? '').trim() || null
    const is_open_to_offers  = formData.get('is_open_to_offers')  === 'true'
    const delivery_available = formData.get('delivery_available') === 'true'

    if (isNaN(price) || price < 0) return { error: 'السعر غير صالح.' }
    if (!condition)                 return { error: 'الرجاء اختيار حالة المنتج.' }
    if (!size_value)                return { error: 'الرجاء اختيار المقاس.' }

    const { error: updateError } = await supabase
      .from('products')
      .update({
        title, category, brand,
        price, condition, size_value, description, city, is_open_to_offers, delivery_available,
      })
      .eq('id', productId)
      .eq('seller_id', user.id)

    if (updateError) return { error: `تعذّر تحديث الإعلان: ${updateError.message}` }

    revalidateTag('products', 'default')
    revalidatePath('/profile')
    revalidatePath('/')
    revalidatePath('/search')
    revalidatePath(`/product/${productId}`)
  } catch (err) {
    return { error: `حدث خطأ غير متوقع: ${err instanceof Error ? err.message : String(err)}` }
  }

  redirect(`/product/${productId}`)
}

export type DeleteListingState = { error: string } | null

/** Sellers can withdraw a listing at any status — this is a real, permanent
 *  delete (not a soft "withdrawn" status), since accidental/unwanted
 *  listings should actually be gone, not linger around. */
export async function deleteProductAction(productId: string): Promise<DeleteListingState> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'يجب تسجيل الدخول أولاً.' }

    const result = await deleteProductForUser(supabase, productId, user.id)
    if ('error' in result) return result

    revalidateTag('products', 'default')
    revalidatePath('/profile')
    revalidatePath('/')
    revalidatePath('/search')
  } catch (err) {
    return { error: `حدث خطأ غير متوقع: ${err instanceof Error ? err.message : String(err)}` }
  }

  return null
}

/* ── Admin helpers ───────────────────────────────────────────────────────── */

export async function requireAdmin() {
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

  const { data, error } = await supabase
    .from('products')
    .update({ status: 'approved' })
    .eq('id', productId)
    .select('seller_id, title')
    .single()

  if (error) throw new Error(error.message)

  revalidateTag('products', 'default')
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/search')

  await notifySellerListingApproved(supabase, {
    sellerId: data.seller_id,
    productId,
    title: data.title,
  })
}

export async function approveProductWithImagesAction(
  productId: string,
  imageUrls: string[],
  category: string,
  brand: string,
) {
  const supabase = await requireAdmin()

  const { data, error } = await supabase
    .from('products')
    .update({ status: 'approved', image_urls: imageUrls, category, brand })
    .eq('id', productId)
    .select('seller_id, title')
    .single()

  if (error) throw new Error(error.message)

  revalidateTag('products', 'default')
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/search')

  await notifySellerListingApproved(supabase, {
    sellerId: data.seller_id,
    productId,
    title: data.title,
  })
}

export async function rejectProductAction(productId: string, _?: FormData) {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('products')
    .update({ status: 'rejected' })
    .eq('id', productId)

  if (error) throw new Error(error.message)

  revalidateTag('products', 'default')
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/search')
}
