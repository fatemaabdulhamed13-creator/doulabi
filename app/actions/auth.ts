'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuthState     = { error: string } | null
export type PasswordState = { error: string } | { success: true } | null
export type DeleteState   = { error: string } | null

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

// ── Change password ───────────────────────────────────────────────────────────

export async function changePasswordAction(
  _prevState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const password = String(formData.get('password') ?? '').trim()
  const confirm  = String(formData.get('confirm')  ?? '').trim()

  if (password.length < 8) return { error: 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.' }
  if (password !== confirm)  return { error: 'كلمتا المرور غير متطابقتين.' }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  return { success: true }
}

// ── Delete account ────────────────────────────────────────────────────────────

export async function deleteAccountAction(
  _prevState: DeleteState,
  _formData: FormData,
): Promise<DeleteState> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // Delete via admin client (bypasses RLS, removes the auth.users row)
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) return { error: error.message }

  // Clear the session cookie after successful deletion
  await supabase.auth.signOut()

  redirect('/')
}
