"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { updateProductAction, type UpdateListingState } from "@/app/actions/product";

/* ── Editable fields config ──────────────────────────────────────────────── */

const CONDITIONS = [
  "جديد بالعلامة",
  "كالجديد",
  "مستعمل - حالة جيدة",
  "مستعمل - حالة مقبولة",
];
// عطور و تجميل ("Perfumes & Beauty") isn't clothing — matches SellForm's
// BEAUTY_CONDITIONS.
const BEAUTY_CONDITIONS = ["جديد مغلق", "جديد مفتوح", "مستعمل"];

const CITIES = [
  "طرابلس", "بنغازي", "مصراتة", "الزاوية", "البيضاء",
  "سبها", "الزنتان", "ترهونة", "الخمس", "زليتن", "أخرى",
];

const LETTER_SIZES       = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const SHOE_SIZES         = Array.from({ length: 10 }, (_, i) => String(36 + i));
// ملابس أطفال ("Kids clothing") — age ranges, matches SellForm's KIDS_SIZES.
const KIDS_SIZES = [
  "0-3 أشهر", "3-6 أشهر", "6-9 أشهر", "9-12 أشهر",
  "1-2 سنة", "2-3 سنوات", "3-4 سنوات", "4-5 سنوات",
  "5-6 سنوات", "6-7 سنوات", "7-8 سنوات", "8-9 سنوات",
  "9-10 سنوات", "10-12 سنة", "12-14 سنة",
];

function getSizeOptions(sizeType: string): string[] {
  // SellForm only ever stores "numbers" for أحذية (shoes) — the numeric
  // clothing sizes (34-56) live inside the combined "letters" dropdown
  // instead, so "numbers" here always means shoes.
  if (sizeType === "numbers")  return SHOE_SIZES;
  if (sizeType === "kids")     return KIDS_SIZES;
  if (sizeType === "one-size") return ["مقاس واحد"];
  return LETTER_SIZES; // "letters" default
}

/* ── Shared styles (mirrors SellForm) ────────────────────────────────────── */

const inputCls =
  "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

const labelCls = "block text-sm font-semibold text-foreground mb-2";

const toggleBtn = (active: boolean) =>
  `flex-1 py-3 rounded-xl text-sm font-semibold border text-center transition-all cursor-pointer ${
    active
      ? "bg-primary text-white border-primary"
      : "bg-card text-foreground border-border hover:border-primary/50"
  }`;

/* ── Types ───────────────────────────────────────────────────────────────── */

type ProductSnapshot = {
  id:                 string;
  title:              string;
  price:              number;
  category:           string;
  brand:              string;
  condition:          string;
  description:        string | null;
  city:               string | null;
  is_open_to_offers:  boolean;
  delivery_available: boolean;
  size_type:          string;
  size_value:         string;
};

/* ── Component ───────────────────────────────────────────────────────────── */

export default function EditListingForm({ product }: { product: ProductSnapshot }) {
  const router = useRouter();

  const boundAction = updateProductAction.bind(null, product.id);
  const [state, formAction, pending] = useActionState<UpdateListingState, FormData>(
    boundAction,
    null,
  );

  // عطور و تجميل has its own field set at creation (SellForm) — mirrored
  // here so editing one doesn't show a clothing size dropdown / condition
  // set that doesn't apply to it.
  const isBeauty = product.category === "عطور و تجميل";
  const conditionOptions = isBeauty ? BEAUTY_CONDITIONS : CONDITIONS;

  return (
    <div dir="rtl" className="min-h-screen bg-background">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-card border-b border-border px-4 h-14 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="رجوع"
        >
          <ArrowRight className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-base font-bold text-foreground flex-1">تعديل الإعلان</h1>
        <p className="text-xs text-muted-foreground line-clamp-1 max-w-[160px]">{product.title}</p>
      </header>

      {/* ── Form ───────────────────────────────────────────────────────── */}
      <form action={formAction}>
        <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">

          {/* Error banner */}
          {state?.error && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-700">{state.error}</p>
            </div>
          )}

          {/* ── Price ──────────────────────────────────────────────────── */}
          <div>
            <label htmlFor="edit-price" className={labelCls}>
              السعر (د.ل)
            </label>
            <input
              id="edit-price"
              name="price"
              type="number"
              min="0"
              step="1"
              defaultValue={product.price}
              required
              className={inputCls}
              placeholder="أدخل السعر"
            />
          </div>

          {/* ── Size ──────────────────────────────────────────────── */}
          <div>
            <label htmlFor="edit-size" className={labelCls}>{isBeauty ? "الحجم" : "المقاس"}</label>
            {isBeauty ? (
              // Free-text, matching SellForm — perfume/beauty sizes
              // (50ml, 100g, ...) vary too much for a fixed list the way
              // clothing/shoe sizes don't.
              <input
                id="edit-size"
                name="size_value"
                type="text"
                defaultValue={product.size_value}
                required
                className={inputCls}
                placeholder="مثال: 50 مل"
              />
            ) : (
              <select
                id="edit-size"
                name="size_value"
                defaultValue={product.size_value}
                required
                className={inputCls}
              >
                {getSizeOptions(product.size_type).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>

          {/* ── Condition ──────────────────────────────────────────────── */}
          <div>
            <label className={labelCls}>حالة المنتج</label>
            <div className="grid grid-cols-2 gap-2">
              {conditionOptions.map((c) => (
                <label key={c} className={toggleBtn(c === product.condition)}>
                  <input
                    type="radio"
                    name="condition"
                    value={c}
                    defaultChecked={c === product.condition}
                    className="sr-only"
                    required
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>

          {/* ── City ───────────────────────────────────────────────────── */}
          <div>
            <label htmlFor="edit-city" className={labelCls}>
              المدينة <span className="text-muted-foreground font-normal">(اختياري)</span>
            </label>
            <select
              id="edit-city"
              name="city"
              defaultValue={product.city ?? ""}
              className={inputCls}
            >
              <option value="">— اختر المدينة —</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* ── Open to offers ─────────────────────────────────────────── */}
          <div>
            <label className={labelCls}>قابل للتفاوض؟</label>
            <div className="flex gap-2">
              <label className={toggleBtn(product.is_open_to_offers)}>
                <input type="radio" name="is_open_to_offers" value="true"
                  defaultChecked={product.is_open_to_offers} className="sr-only" />
                نعم
              </label>
              <label className={toggleBtn(!product.is_open_to_offers)}>
                <input type="radio" name="is_open_to_offers" value="false"
                  defaultChecked={!product.is_open_to_offers} className="sr-only" />
                لا
              </label>
            </div>
          </div>

          {/* ── Delivery ───────────────────────────────────────────────── */}
          <div>
            <label className={labelCls}>التوصيل خارج المدينة؟</label>
            <div className="flex gap-2">
              <label className={toggleBtn(product.delivery_available)}>
                <input type="radio" name="delivery_available" value="true"
                  defaultChecked={product.delivery_available} className="sr-only" />
                يوجد توصيل
              </label>
              <label className={toggleBtn(!product.delivery_available)}>
                <input type="radio" name="delivery_available" value="false"
                  defaultChecked={!product.delivery_available} className="sr-only" />
                داخل المدينة فقط
              </label>
            </div>
          </div>

          {/* ── Description ────────────────────────────────────────────── */}
          <div>
            <label htmlFor="edit-desc" className={labelCls}>
              الوصف <span className="text-muted-foreground font-normal">(اختياري)</span>
            </label>
            <textarea
              id="edit-desc"
              name="description"
              rows={5}
              maxLength={500}
              defaultValue={product.description ?? ""}
              className={`${inputCls} resize-none`}
              placeholder="أضف وصفاً تفصيلياً للمنتج..."
            />
          </div>

          {/* ── Read-only info note ──────────────────────────────────── */}
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-4 py-3 leading-relaxed">
            ملاحظة: لا يمكن تعديل الصور أو الفئة أو الماركة بعد النشر. تواصل مع الدعم إذا احتجت لذلك.
          </p>

          {/* ── Submit ─────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={pending}
            className="
              w-full py-4 rounded-2xl
              bg-primary text-white font-bold text-[15px]
              hover:brightness-110 active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-all shadow-[0_4px_24px_rgba(93,42,66,0.30)]
              flex items-center justify-center gap-2
            "
          >
            {pending && <Loader2 className="h-5 w-5 animate-spin shrink-0" />}
            {pending ? "جاري الحفظ..." : "حفظ التغييرات"}
          </button>

        </div>
      </form>
    </div>
  );
}
