'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuthState     = { error: string } | null
export type PasswordState = { error: string } | { success: true } | null
export type DeleteState   = { error: string } | null

// Libyan mobile numbers: 9 digits, always starting with 9 (91/92/94/95…).
// This is the only validation the WhatsApp number gets now that the
// client-side "test the wa.me link" gate is gone — enforced here too so a
// direct POST can't bypass the signup form's own check.
const WHATSAPP_LOCAL_PATTERN = /^9\d{8}$/

export async function signUpAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const full_name         = String(formData.get('full_name')       ?? '')
  const email              = String(formData.get('email')           ?? '')
  const whatsapp_local     = String(formData.get('whatsapp_number') ?? '').replace(/\D/g, '')
  const password           = String(formData.get('password')        ?? '')

  if (!WHATSAPP_LOCAL_PATTERN.test(whatsapp_local)) {
    return { error: 'رقم الواتساب غير صحيح. أدخل 9 أرقام تبدأ بـ 9 (مثال: 91XXXXXXX).' }
  }
  const whatsapp_number = '+218' + whatsapp_local

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

// ── Forgot password (send recovery email) ───────────────────────────────────

export async function forgotPasswordAction(
  _prevState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const email = String(formData.get('email') ?? '').trim()

  if (!email) return { error: 'يرجى إدخال بريدك الإلكتروني.' }

  const supabase = await createClient()

  // Origin header is present because this action runs as a same-origin
  // fetch POST triggered by the <form action={...}> submission.
  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  })

  if (error) return { error: error.message }

  return { success: true }
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
