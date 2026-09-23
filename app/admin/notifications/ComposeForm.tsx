'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Send, FlaskConical, Smartphone, Users } from 'lucide-react'
import {
  sendNotificationAction,
  sendTestNotificationAction,
  type TargetPlatform,
} from '@/app/actions/notifications'
import { TITLE_MAX_LEN, BODY_MAX_LEN } from '@/lib/push/constants'

const PLATFORM_OPTIONS: { value: TargetPlatform; label: string }[] = [
  { value: 'all', label: 'كل الأجهزة' },
  { value: 'ios', label: 'iOS فقط' },
  { value: 'android', label: 'Android فقط' },
]

type LinkType = 'none' | 'listing' | 'collection'

const LINK_TYPE_OPTIONS: { value: LinkType; label: string }[] = [
  { value: 'none', label: 'بدون رابط' },
  { value: 'listing', label: 'منتج' },
  { value: 'collection', label: 'تشكيلة' },
]

const INPUT_CLS = `
  w-full rounded-xl border border-border bg-background
  px-4 py-2.5 text-sm text-foreground
  focus:outline-none focus:ring-2 focus:ring-primary/40
  disabled:opacity-50
`.trim()

export function ComposeForm({ iosCount, androidCount }: { iosCount: number; androidCount: number }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>('all')
  const [linkType, setLinkType] = useState<LinkType>('none')
  const [listingId, setListingId] = useState('')
  const [collectionSlug, setCollectionSlug] = useState('')
  const [testUserId, setTestUserId] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const [isSending, startSend] = useTransition()
  const [isTesting, startTest] = useTransition()

  const recipientCount =
    targetPlatform === 'all' ? iosCount + androidCount : targetPlatform === 'ios' ? iosCount : androidCount

  const titleOverLimit = title.length > TITLE_MAX_LEN
  const bodyOverLimit = body.length > BODY_MAX_LEN
  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !titleOverLimit && !bodyOverLimit

  function resetComposer() {
    setTitle('')
    setBody('')
    setLinkType('none')
    setListingId('')
    setCollectionSlug('')
  }

  function handleConfirmSend() {
    startSend(async () => {
      const res = await sendNotificationAction({
        title,
        body,
        targetPlatform,
        listingId: linkType === 'listing' ? listingId || undefined : undefined,
        collectionSlug: linkType === 'collection' ? collectionSlug || undefined : undefined,
      })
      setShowConfirm(false)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`تم الإرسال — ${res.successCount} نجاح، ${res.failureCount} فشل`)
      resetComposer()
    })
  }

  function handleTestSend() {
    if (!testUserId.trim()) {
      toast.error('أدخل معرّف المستخدم (User ID) أولاً.')
      return
    }
    startTest(async () => {
      const res = await sendTestNotificationAction({ title, body, testUserId })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('تم إرسال الإشعار التجريبي.')
    })
  }

  return (
    <section className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-primary shrink-0" />
        <h2 className="text-sm font-bold text-foreground">إرسال إشعار جماعي</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Composer ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground">العنوان</label>
              <span className={`text-[11px] font-medium ${titleOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
                {title.length} / {TITLE_MAX_LEN}
              </span>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: عروض نهاية الأسبوع 🔥"
              className={INPUT_CLS}
              disabled={isSending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground">نص الإشعار</label>
              <span className={`text-[11px] font-medium ${bodyOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
                {body.length} / {BODY_MAX_LEN}
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="اكتب نص الإشعار هنا..."
              rows={3}
              className={`${INPUT_CLS} resize-none`}
              disabled={isSending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground">رابط الإشعار (اختياري)</label>
            <div className="flex gap-2">
              {LINK_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLinkType(opt.value)}
                  disabled={isSending}
                  className={`
                    flex-1 rounded-xl py-2 text-sm font-bold transition-colors
                    disabled:opacity-50
                    ${linkType === opt.value ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {linkType === 'listing' && (
              <input
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                placeholder="product id — يفتح صفحة المنتج عند الضغط على الإشعار"
                className={INPUT_CLS}
                disabled={isSending}
              />
            )}
            {linkType === 'collection' && (
              <input
                value={collectionSlug}
                onChange={(e) => setCollectionSlug(e.target.value)}
                placeholder="collection slug — مثال: fall-lookbook-2026"
                className={INPUT_CLS}
                disabled={isSending}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground">الفئة المستهدفة</label>
            <div className="flex gap-2">
              {PLATFORM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTargetPlatform(opt.value)}
                  disabled={isSending}
                  className={`
                    flex-1 rounded-xl py-2 text-sm font-bold transition-colors
                    disabled:opacity-50
                    ${targetPlatform === opt.value ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
              <Users className="h-3 w-3 shrink-0" />
              سيصل الإشعار إلى {recipientCount} جهاز نشط (iOS: {iosCount} · Android: {androidCount})
            </p>
          </div>

          {/* Test send */}
          <div className="flex flex-col gap-1.5 pt-3 border-t border-border">
            <label className="text-xs font-bold text-muted-foreground">إرسال تجريبي إلى مستخدم محدد</label>
            <div className="flex gap-2">
              <input
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                placeholder="User ID"
                className={INPUT_CLS}
                disabled={isTesting}
              />
              <button
                type="button"
                onClick={handleTestSend}
                disabled={isTesting || !title.trim() || !body.trim()}
                className="
                  shrink-0 flex items-center gap-1.5 px-4 rounded-xl
                  bg-muted hover:bg-muted/70 text-foreground font-bold text-sm
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                "
              >
                <FlaskConical className="h-4 w-4 shrink-0" />
                تجربة
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={!canSubmit || isSending}
            className="
              flex items-center justify-center gap-2 py-3 rounded-xl
              bg-primary hover:opacity-90 text-white font-bold text-sm
              active:scale-[0.98] transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <Send className="h-4 w-4 shrink-0" />
            {isSending ? 'جاري الإرسال...' : 'إرسال للجميع'}
          </button>
        </div>

        {/* ── Live preview ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5 shrink-0" />
            معاينة مباشرة
          </div>

          {/* iOS-style banner */}
          <div className="bg-neutral-100 rounded-2xl p-3 flex flex-col gap-1.5 shadow-sm">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">iOS · دولابي</span>
            <div className="flex gap-2.5 items-start">
              <Image
                src="/icon.png"
                width={36}
                height={36}
                alt="أيقونة تطبيق دولابي"
                className="w-9 h-9 rounded-lg bg-primary shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-neutral-900 truncate">{title || 'عنوان الإشعار'}</p>
                <p className="text-sm text-neutral-700 line-clamp-2">{body || 'نص الإشعار سيظهر هنا...'}</p>
              </div>
            </div>
          </div>

          {/* Android-style banner */}
          <div className="bg-white border border-neutral-200 rounded-lg p-3 flex gap-2.5 items-start shadow-sm">
            <Image
              src="/icon.png"
              width={32}
              height={32}
              alt="أيقونة تطبيق دولابي"
              className="w-8 h-8 rounded-full bg-primary shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-neutral-500">دولابي</span>
                <span className="text-[10px] text-neutral-400">الآن</span>
              </div>
              <p className="text-sm font-bold text-neutral-900 truncate">{title || 'عنوان الإشعار'}</p>
              <p className="text-sm text-neutral-600 line-clamp-2">{body || 'نص الإشعار سيظهر هنا...'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirmation modal ───────────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4">
            <h3 className="text-base font-bold text-foreground">تأكيد الإرسال الجماعي</h3>
            <p className="text-sm text-muted-foreground">
              سيتم إرسال هذا الإشعار إلى{' '}
              <span className="font-bold text-foreground">{recipientCount} جهاز</span>{' '}
              ({PLATFORM_OPTIONS.find((o) => o.value === targetPlatform)?.label}). هذا الإجراء لا يمكن التراجع عنه.
            </p>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-sm font-bold text-foreground truncate">{title}</p>
              <p className="text-sm text-muted-foreground line-clamp-2">{body}</p>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isSending}
                className="flex-1 py-2.5 rounded-xl bg-muted hover:bg-muted/70 text-foreground font-bold text-sm disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={isSending}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white font-bold text-sm disabled:opacity-50"
              >
                {isSending ? 'جاري الإرسال...' : 'تأكيد الإرسال'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
