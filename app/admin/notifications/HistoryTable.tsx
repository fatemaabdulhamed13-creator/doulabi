import { History } from 'lucide-react'

export type Campaign = {
  id: string
  title: string
  body: string
  target_platform: 'all' | 'ios' | 'android'
  total_recipients: number
  success_count: number
  failure_count: number
  created_at: string
}

const PLATFORM_LABEL: Record<Campaign['target_platform'], string> = {
  all: 'الكل',
  ios: 'iOS',
  android: 'Android',
}

export function HistoryTable({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
        <History className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="text-sm font-bold text-foreground">سجل الإشعارات المرسلة</h2>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          لم يتم إرسال أي إشعار بعد.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-right font-semibold px-5 py-2.5">التاريخ</th>
                <th className="text-right font-semibold px-5 py-2.5">العنوان</th>
                <th className="text-right font-semibold px-5 py-2.5">الفئة</th>
                <th className="text-right font-semibold px-5 py-2.5">المستلمون</th>
                <th className="text-right font-semibold px-5 py-2.5">النجاح</th>
                <th className="text-right font-semibold px-5 py-2.5">الفشل</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(c.created_at).toLocaleString('ar-LY', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-3 font-medium text-foreground max-w-xs truncate" title={c.title}>
                    {c.title}
                  </td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-bold">
                      {PLATFORM_LABEL[c.target_platform]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-foreground">{c.total_recipients}</td>
                  <td className="px-5 py-3 text-emerald-600 font-semibold">{c.success_count}</td>
                  <td className="px-5 py-3 font-semibold">
                    <span className={c.failure_count > 0 ? 'text-red-500' : 'text-muted-foreground'}>
                      {c.failure_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
