'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, BellRing } from 'lucide-react'

const TABS = [
  { href: '/admin', label: 'المراجعة', icon: ClipboardList },
  { href: '/admin/notifications', label: 'الإشعارات', icon: BellRing },
]

export function AdminTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors
              ${active
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:bg-muted'}
            `}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
