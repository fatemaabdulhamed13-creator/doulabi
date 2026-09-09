import { createClient } from '@/lib/supabase/server'
import { ComposeForm } from './ComposeForm'
import { HistoryTable, type Campaign } from './HistoryTable'

// Auth + is_admin gate lives in app/admin/layout.tsx.
export default async function AdminNotificationsPage() {
  const supabase = await createClient()

  const [iosCount, androidCount, campaignsResult] = await Promise.all([
    supabase
      .from('device_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('platform', 'ios'),
    supabase
      .from('device_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('platform', 'android'),
    supabase
      .from('notification_campaigns')
      .select('id, title, body, target_platform, total_recipients, success_count, failure_count, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
      .returns<Campaign[]>(),
  ])

  return (
    <main className="max-w-5xl mx-auto p-8 flex flex-col gap-8">
      <ComposeForm iosCount={iosCount.count ?? 0} androidCount={androidCount.count ?? 0} />
      <HistoryTable campaigns={campaignsResult.data ?? []} />
    </main>
  )
}
