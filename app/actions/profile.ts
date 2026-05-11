'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ProfileState = { error: string } | { success: true } | null

export async function updateProfileAction(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const full_name       = String(formData.get('name')        ?? '').trim()
  const whatsapp_number = String(formData.get('whatsapp')    ?? '').trim() || null
  const city            = String(formData.get('city')        ?? '').trim() || null
  const bio             = String(formData.get('bio')         ?? '').trim() || null

  if (!full_name) return { error: 'الاسم مطلوب.' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, whatsapp_number, city, bio })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  revalidatePath('/profile/edit')

  return { success: true }
}
