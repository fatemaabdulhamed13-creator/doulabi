import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminTabs } from './AdminTabs'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // ── Security gate ───────────────────────────────────────────────────────
  // Shared by every /admin/* route — individual pages don't need to repeat it.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-6 h-14 flex items-center gap-4">
        <h1 className="text-base font-bold text-foreground shrink-0">لوحة الإدارة</h1>
        <AdminTabs />
      </header>
      {children}
    </div>
  )
}
