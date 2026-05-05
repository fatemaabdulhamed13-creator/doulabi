'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AuthState = { error: string } | null

export async function signUpAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const full_name       = String(formData.get('full_name')       ?? '')
  const email           = String(formData.get('email')           ?? '')
  const whatsapp_number = '+218' + String(formData.get('whatsapp_number') ?? '')
  const password        = String(formData.get('password')        ?? '')

  const supabase = await createClient()

  const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

  if (signUpError) return { error: signUpError.message }
  if (!data.user)  return { error: 'فشل إنشاء الحساب، يرجى المحاولة مرة أخرى.' }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, full_name, whatsapp_number })

  if (profileError) return { error: profileError.message }

  redirect('/profile')
}

export async function logInAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email    = String(formData.get('email')    ?? '')
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  redirect('/')
}

export async function signOutAction(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
