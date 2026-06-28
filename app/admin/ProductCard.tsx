'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { CheckCircle, XCircle } from 'lucide-react'
import {
  approveProductWithImagesAction,
  rejectProductAction,
} from '@/app/actions/product'
import { BRANDS } from '@/lib/brands'

export type PendingProduct = {
  id:               string
  title:            string
  price:            number
  category:         string
  brand:            string
  size_type:        string
  size_value:       string
  condition:        string
  description:      string | null
  image_urls:       string[]
  created_at:       string
  profiles: {
    full_name:       string
    whatsapp_number: string
  } | null
}

/* ── Canonical category list (mirrors SellForm) ─────────────────────────── */
const CATEGORIES = [
  'فساتين', 'أحذية', 'حقائب', 'إكسسوارات',
  'ملابس رجالية', 'ملابس أطفال', 'ملابس رياضية', 'ملابس تقليدية', 'أخرى',
]

/* ── Shared select style ────────────────────────────────────────────────── */
const SELECT_CLS = `
  w-full rounded-lg border border-border bg-background
  px-2.5 py-1.5 text-sm text-foreground
  focus:outline-none focus:ring-2 focus:ring-primary/40
  disabled:opacity-50 cursor-pointer
`.trim()

export function ProductCard({ product }: { product: PendingProduct }) {
  const [images,   setImages]   = useState(product.image_urls)
  const [category, setCategory] = useState(product.category)
  const [brand,    setBrand]    = useState(product.brand)
  const [isPending, startTransition] = useTransition()

  function moveImage(idx: number, delta: -1 | 1) {
    const next = [...images]
    const target = idx + delta
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setImages(next)
  }

  function handleApprove() {
    startTransition(() =>
      approveProductWithImagesAction(product.id, images, category, brand)
    )
  }

  function handleReject() {
    startTransition(() => rejectProductAction(product.id))
  }

  const postedAt = new Date(product.created_at).toLocaleDateString('ar-LY', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col gap-0">

      {/* ── Image strip ──────────────────────────────────────────────────── */}
      {images.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto p-4 bg-muted/40 border-b border-border scrollbar-none">
          {images.map((url, idx) => (
            <div
              key={url + idx}
              className="relative group shrink-0 w-48 h-48 rounded-xl overflow-hidden bg-muted ring-1 ring-border"
            >
              <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                <Image
                  src={url}
                  alt={`${product.title} — صورة ${idx + 1}`}
                  fill
                  unoptimized
                  sizes="192px"
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </a>

              {/* Cover badge */}
              {idx === 0 && (
                <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none">
                  رئيسية
                </span>
              )}

              {/* ▶ Move right (toward cover / lower index) — on CSS-right side */}
              {idx > 0 && (
                <button
                  onClick={() => moveImage(idx, -1)}
                  disabled={isPending}
                  className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/65 hover:bg-black/80 text-white px-1.5 py-3 rounded-l-lg text-sm leading-none disabled:opacity-30"
                  title="نقل يميناً"
                >
                  ▶
                </button>
              )}

              {/* ◀ Move left (away from cover / higher index) — on CSS-left side */}
              {idx < images.length - 1 && (
                <button
                  onClick={() => moveImage(idx, 1)}
                  disabled={isPending}
                  className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/65 hover:bg-black/80 text-white px-1.5 py-3 rounded-r-lg text-sm leading-none disabled:opacity-30"
                  title="نقل يساراً"
                >
                  ◀
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="h-20 bg-muted/40 border-b border-border flex items-center justify-center">
          <span className="text-xs text-muted-foreground">لا توجد صور</span>
        </div>
      )}

      {/* ── Details + actions ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-row gap-4 p-5">

        {/* Info block */}
        <div className="flex-1 flex flex-col gap-2.5 min-w-0">

          {/* Title + price */}
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-bold text-foreground leading-snug">
              {product.title}
            </h2>
            <span className="shrink-0 text-base font-black text-primary">
              {product.price}{' '}
              <span className="text-xs font-normal text-muted-foreground">د.ل</span>
            </span>
          </div>

          {/* ── Inline-editable Category & Brand ──────────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                الفئة
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isPending}
                className={SELECT_CLS}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                البراند
              </label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                disabled={isPending}
                className={SELECT_CLS}
              >
                {/* Keep the submitted value as an option even if it's not in BRANDS */}
                {!BRANDS.some((b) => b.value === brand) && (
                  <option value={brand}>{brand}</option>
                )}
                {BRANDS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label} — {b.value}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Remaining meta pills (size, condition) */}
          <div className="flex flex-wrap gap-1.5">
            {[
              `${product.size_value} (${product.size_type === 'letters' ? 'حروف' : 'أرقام'})`,
              product.condition,
            ].map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-full bg-muted text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            {/* Dim indicator when admin has changed category or brand */}
            {(category !== product.category || brand !== product.brand) && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                ✎ تم التعديل
              </span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {product.description}
            </p>
          )}

          {/* Seller */}
          <div className="mt-auto pt-2 border-t border-border flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">البائع: </span>
              {product.profiles?.full_name ?? '—'}
            </span>
            {product.profiles?.whatsapp_number && (
              <a
                href={`https://wa.me/${product.profiles.whatsapp_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-green-600 hover:underline"
              >
                واتساب
              </a>
            )}
            <span className="mr-auto">{postedAt}</span>
          </div>
        </div>

        {/* ── Action buttons ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 shrink-0 justify-center">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="
              w-36 flex items-center justify-center gap-1.5
              py-2.5 px-4 rounded-xl
              bg-emerald-500 hover:bg-emerald-600
              text-white font-bold text-sm
              active:scale-[0.97] transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <CheckCircle className="h-4 w-4 shrink-0" />
            قبول
          </button>

          <button
            onClick={handleReject}
            disabled={isPending}
            className="
              w-36 flex items-center justify-center gap-1.5
              py-2.5 px-4 rounded-xl
              bg-red-500 hover:bg-red-600
              text-white font-bold text-sm
              active:scale-[0.97] transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <XCircle className="h-4 w-4 shrink-0" />
            رفض
          </button>
        </div>
      </div>
    </article>
  )
}
