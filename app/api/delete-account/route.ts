import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolves the authenticated user id from either a browser session cookie
 * (web app) or an `Authorization: Bearer <access_token>` header (mobile app,
 * which has no browser cookie jar to rely on).
 * Mirrors the identical helper in app/api/upload-raw/route.ts.
 */
async function getAuthedUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    const anon = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await anon.auth.getUser(token)
    return error ? null : data.user?.id ?? null
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/delete-account
 * Permanently deletes the authenticated user's auth.users row via the
 * service-role admin client — same call the web app's own settings page
 * already makes through deleteAccountAction, just reachable over HTTP so the
 * mobile app (no Server Actions support) can call it too, authenticated via
 * a Bearer token instead of a session cookie.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthedUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(userId)

    if (error) {
      console.error('[delete-account POST] failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[delete-account POST] unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
