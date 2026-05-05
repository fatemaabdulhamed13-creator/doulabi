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

  const name = String(formData.get('name') ?? '').trim()
  const city = String(formData.get('city') ?? '').trim()
  const bio  = String(formData.get('bio')  ?? '').trim() || null

  if (!name) return { error: 'الاسم مطلوب.' }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, name, city: city || null, bio }, { onConflict: 'id' })

  if (error) return { error: error.message }

  revalidatePath('/profile')
  revalidatePath('/profile/edit')

  return { success: true }
}
