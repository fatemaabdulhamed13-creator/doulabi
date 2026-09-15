'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ProfileState = { error: string } | { success: true } | null

// WhatsApp is optional here, but if one is given it must be a plausible
// Libyan mobile number (9 digits starting with 9, with or without the 218
// country code / a leading 0) — matches EditProfileForm's client-side
// check, enforced again here so a direct POST can't bypass it.
function isValidWhatsapp(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  if (digits === '') return true
  const local = digits.replace(/^218/, '').replace(/^0/, '')
  return /^9\d{8}$/.test(local)
}

export async function updateProfileAction(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const full_name       = String(formData.get('name')        ?? '').trim()
  const whatsapp_raw     = String(formData.get('whatsapp')    ?? '').trim()
  const city            = String(formData.get('city')        ?? '').trim() || null
  const bio             = String(formData.get('bio')         ?? '').trim() || null

  if (!full_name) return { error: 'الاسم مطلوب.' }
  if (!isValidWhatsapp(whatsapp_raw)) {
    return { error: 'رقم الواتساب غير صحيح. أدخل رقم ليبي صحيح (مثال: 218912345678).' }
  }
  const whatsapp_number = whatsapp_raw || null

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, whatsapp_number, city, bio })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  revalidatePath('/profile/edit')

  return { success: true }
}
