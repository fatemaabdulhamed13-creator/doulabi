"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Camera, ChevronDown, Loader2, ShieldAlert, X } from "lucide-react";
import { createListingAction } from "@/app/actions/product";
import PageHeader from "@/components/PageHeader";
import { SUB_CATEGORIES } from "@/lib/subcategories";
import { compressListingImages } from "@/lib/imageCompression";

/* ── Data ────────────────────────────────────────────────────────────────── */

const CATEGORIES = [
  "فساتين", "أحذية", "حقائب", "إكسسوارات",
  "ملابس رجالية", "ملابس أطفال", "ملابس رياضية", "ملابس تقليدية", "أخرى",
];

const CONDITIONS = ["جديد بالعلامة", "كالجديد", "مستعمل - حالة جيدة", "مستعمل - حالة مقبولة"];

const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const CLOTHING_NUM_SIZES = Array.from({ length: 12 }, (_, i) => String(34 + i * 2));
const SHOE_SIZES = Array.from({ length: 10 }, (_, i) => String(36 + i));

const BRANDS = [
  { value: "Zara",         label: "زارا"       },
  { value: "Monsoon",      label: "مونسون"     },
  { value: "Dune",         label: "ديون"       },
  { value: "Sherri Hill",  label: "شيري هيل"   },
  { value: "Michael Kors", label: "مايكل كورس" },
  { value: "Gizia",        label: "جيزيا"      },
  { value: "Other",        label: "أخرى"       },
];

const COLORS = [
  "أسود", "أبيض", "رمادي", "بيج", "بني",
  "أزرق", "أخضر", "أحمر", "وردي", "برتقالي",
  "أصفر", "بنفسجي", "ذهبي", "فضي", "متعدد الألوان",
];

const CITIES = [
  "طرابلس", "بنغازي", "مصراتة", "الزاوية", "البيضاء",
  "سبها", "الزنتان", "زوارة", "غريان", "ترهونة",
  "الخمس", "سرت", "درنة", "توبرق",
];

/* ── Shared styles ───────────────────────────────────────────────────────── */

const input =
  "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

const fieldLabel = "block text-sm font-semibold text-foreground mb-2";

const pill = (active: boolean) =>
  `min-w-[3.5rem] px-4 py-3 rounded-xl text-sm font-semibold border text-center transition-all ${
    active
      ? "bg-primary text-white border-primary"
      : "bg-card text-foreground border-border hover:border-primary/50"
  }`;

/* ── Form ────────────────────────────────────────────────────────────────── */

export default function SellForm() {
  const [state, formAction, pending] = useActionState(createListingAction, null);

  const [images,      setImages]      = useState<File[]>([]);
  const [previews,    setPreviews]    = useState<string[]>([]);
  // compressing[i] tracks 0-100 progress for each incoming file slot
  const [compressing, setCompressing] = useState<number[] | null>(null);

  const [title,       setTitle]       = useState("");
  const [price,       setPrice]       = useState("");
  const [negotiable,  setNegotiable]  = useState(false);
  const [category,    setCategory]    = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [brand,       setBrand]       = useState("");
  const [size,        setSize]        = useState("");
  const [condition,   setCondition]   = useState("");
  const [color,       setColor]       = useState("");
  const [city,        setCity]        = useState("");
  const [deliveryAvail, setDeliveryAvail] = useState(false);
  const [description, setDescription] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Returns true while at least one file is still being compressed. */
  const isCompressing = compressing !== null && compressing.some((p) => p < 100);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    // Initialise progress slots (0 % each) for the incoming batch
    const progress = files.map(() => 0);
    setCompressing(progress);

    try {
      const compressed = await compressListingImages(
        files,
        (fileIdx, pct) => {
          setCompressing((prev) => {
            if (!prev) return prev;
            const next = [...prev];
            next[fileIdx] = pct;
            return next;
          });
        },
      );

      const newPreviews = compressed.map((f) => URL.createObjectURL(f));
      setImages((prev) => [...prev, ...compressed]);
      setPreviews((prev) => [...prev, ...newPreviews]);
    } finally {
      setCompressing(null);
      e.target.value = "";
    }
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(previews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  const isOneSize = category === "حقائب" || category === "إكسسوارات";
  const sizeType  = category === "أحذية" ? "numbers"
    : isOneSize ? "one-size"
    : "letters";

  function handleCategoryChange(newCat: string) {
    setCategory(newCat);
    setSubcategory(""); // reset whenever main category changes
    const autoOneSize = newCat === "حقائب" || newCat === "إكسسوارات";
    setSize(autoOneSize ? "مقاس واحد" : "");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Inject compressed images — the hidden file input has no name so it
    // won't duplicate here; we append the already-processed File objects.
    images.forEach((f) => fd.append("images", f));
    startTransition(() => formAction(fd));
  }


  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 pb-32">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <PageHeader title="بيع منتج جديد" />

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <div className="md:max-w-5xl mx-auto md:mt-8 md:mb-12">
      <form className="px-4 pt-6" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative">

        {/* ── Left column: Image upload ─────────────────────────────── */}
        <div className="md:col-span-5 md:sticky top-28">
          <p className={fieldLabel}>الصور</p>

          {/* No name attr — images are injected manually in handleSubmit */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />

          <label
            htmlFor="image-upload"
            onClick={() => !isCompressing && fileInputRef.current?.click()}
            aria-disabled={isCompressing}
            className={`
              relative w-full aspect-video rounded-2xl
              border-2 border-dashed border-border bg-muted
              flex flex-col items-center justify-center gap-3
              transition-all duration-200
              ${isCompressing
                ? "cursor-not-allowed opacity-70"
                : "hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              }
            `}
          >
            {isCompressing ? (
              /* ── Compression in-progress overlay ── */
              <div className="flex flex-col items-center gap-3 px-6 w-full">
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
                <p className="text-sm font-semibold text-foreground">جاري ضغط الصور…</p>
                {compressing && (
                  <div className="w-full space-y-1.5 mt-1">
                    {compressing.map((pct, idx) => (
                      <div key={idx} className="w-full">
                        <div className="flex justify-between text-[11px] text-muted-foreground mb-0.5">
                          <span>صورة {idx + 1}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted-foreground/20 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-200"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ── Default idle state ── */
              <>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="h-7 w-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">رفع صور المنتج</p>
                  <p className="text-xs text-muted-foreground mt-1">اضغط لإضافة حتى ٨ صور</p>
                </div>
              </>
            )}
          </label>

          <div className="mt-4 bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex gap-3">
            <div className="flex-shrink-0 text-amber-600 mt-0.5">
              <ShieldAlert size={18} strokeWidth={2} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 mb-1">شروط قبول الإعلان</h4>
              <ul className="text-xs text-amber-700/80 space-y-1.5 list-disc list-inside">
                <li>يجب أن تكون الصور من تصويرك الشخصي (يمنع استخدام صور من الإنترنت).</li>
                <li>يجب أن تكون الصور واضحة الإضاءة وتظهر تفاصيل القطعة.</li>
                <li>يجب كتابة وصف دقيق يوضح حالة القطعة وأي عيوب إن وجدت.</li>
              </ul>
            </div>
          </div>

          {previews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="
                      absolute top-1 left-1
                      w-6 h-6 rounded-full
                      bg-red-500 text-white
                      flex items-center justify-center
                      shadow-md hover:bg-red-600
                      transition-colors
                    "
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right column: All form fields ────────────────────────── */}
        <div className="md:col-span-7">

          {/* ── Card 1: Basic Info ─────────────────────────────────── */}
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 mb-6">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-1 border-b border-gray-100">
              المعلومات الأساسية
            </h3>

            {/* Title */}
            <div>
              <label htmlFor="title" className={fieldLabel}>عنوان الإعلان</label>
              <input
                id="title"
                name="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: معطف زارا أزرق مقاس M"
                dir="rtl"
                required
                className={input}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className={fieldLabel}>الفئة</label>
              <div className="relative">
                <select
                  id="category"
                  name="category"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  dir="rtl"
                  required
                  className={`${input} appearance-none cursor-pointer`}
                >
                  <option value="" disabled>اختر الفئة</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Sub-category pills — shown only when the selected category has sub-categories */}
            {category && SUB_CATEGORIES[category] && (
              <div>
                <p className={fieldLabel}>الفئة الفرعية <span className="font-normal text-muted-foreground text-xs">(اختياري)</span></p>
                <div className="flex flex-wrap gap-2">
                  {SUB_CATEGORIES[category].map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSubcategory(sub === subcategory ? "" : sub)}
                      className={pill(subcategory === sub)}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Brand */}
            <div>
              <p className={fieldLabel}>الماركة</p>
              <div className="flex flex-wrap gap-2">
                {BRANDS.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBrand(b.value === brand ? "" : b.value)}
                    className={pill(brand === b.value)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Card 2: Details ────────────────────────────────────── */}
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 mb-6">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-1 border-b border-gray-100">
              التفاصيل
            </h3>

            {/* Color */}
            <div>
              <label htmlFor="color" className={fieldLabel}>اللون</label>
              <div className="relative">
                <select
                  id="color"
                  name="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  dir="rtl"
                  className={`${input} appearance-none cursor-pointer`}
                >
                  <option value="">اختر اللون</option>
                  {COLORS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Size */}
            <div>
              <p className={fieldLabel}>المقاس</p>
              {isOneSize ? (
                <div className={`${input} text-muted-foreground select-none cursor-default`}>
                  مقاس واحد
                </div>
              ) : (
                <div className="relative">
                  <select
                    name="size_value"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    dir="rtl"
                    required
                    className={`${input} appearance-none cursor-pointer`}
                  >
                    <option value="" disabled>اختر المقاس</option>
                    {category === "أحذية" ? (
                      SHOE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)
                    ) : category === "فساتين" ? (
                      <>
                        <optgroup label="حروف">
                          {LETTER_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </optgroup>
                        <optgroup label="أرقام">
                          {CLOTHING_NUM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </optgroup>
                      </>
                    ) : (
                      <>
                        <optgroup label="حروف">
                          {LETTER_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </optgroup>
                        <optgroup label="أرقام">
                          {CLOTHING_NUM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </optgroup>
                      </>
                    )}
                  </select>
                  <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              )}
            </div>

            {/* Condition */}
            <div>
              <p className={fieldLabel}>الحالة</p>
              <div className="grid grid-cols-2 gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCondition(c === condition ? "" : c)}
                    className={`
                      py-3 px-3 rounded-xl text-xs font-semibold border text-center transition-all
                      ${condition === c
                        ? "bg-primary text-white border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/50"
                      }
                    `}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Card 3: Pricing & Delivery ─────────────────────────── */}
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 mb-6">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-1 border-b border-gray-100">
              السعر والتوصيل
            </h3>

            {/* Price */}
            <div>
              <label htmlFor="price" className={fieldLabel}>السعر</label>
              <div className="relative">
                <input
                  id="price"
                  name="price"
                  type="number"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  dir="rtl"
                  required
                  min="0"
                  className={`${input} pl-14`}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none select-none">
                  د.ل
                </span>
              </div>
            </div>

            {/* Negotiable toggle */}
            <label className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-card cursor-pointer hover:border-primary/50 transition-colors">
              <span className="text-sm font-medium text-foreground">قابل للتفاوض</span>
              <div
                role="switch"
                aria-checked={negotiable}
                onClick={() => setNegotiable((n) => !n)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                  negotiable ? "bg-primary" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    negotiable ? "-translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>

            {/* City */}
            <div>
              <label htmlFor="city" className={fieldLabel}>المدينة</label>
              <div className="relative">
                <select
                  id="city"
                  name="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  dir="rtl"
                  className={`${input} appearance-none cursor-pointer`}
                >
                  <option value="">اختر المدينة</option>
                  {CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Delivery toggle */}
            <label className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-card cursor-pointer hover:border-primary/50 transition-colors">
              <span className="text-sm font-medium text-foreground">مستعد للتوصيل خارج المدينة</span>
              <div
                role="switch"
                aria-checked={deliveryAvail}
                onClick={() => setDeliveryAvail((d) => !d)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                  deliveryAvail ? "bg-primary" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    deliveryAvail ? "-translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>

            {/* Description */}
            <div>
              <label htmlFor="description" className={fieldLabel}>الوصف</label>
              <textarea
                id="description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اكتب تفاصيل المنتج، سبب البيع، أي عيوب إن وجدت…"
                dir="rtl"
                rows={4}
                maxLength={500}
                className={`${input} resize-none leading-relaxed`}
              />
              <p className="text-xs text-muted-foreground mt-1.5 text-left">
                {description.length} / 500
              </p>
            </div>
          </div>

          {/* ── Hidden inputs for custom-UI state ──────────────────── */}
          <input type="hidden" name="brand"              value={brand} />
          <input type="hidden" name="subcategory"        value={subcategory} />
          <input type="hidden" name="size_type"          value={sizeType} />
          {isOneSize && <input type="hidden" name="size_value" value="مقاس واحد" />}
          <input type="hidden" name="condition"          value={condition} />
          <input type="hidden" name="is_open_to_offers"  value={String(negotiable)} />
          <input type="hidden" name="delivery_available" value={String(deliveryAvail)} />

          {/* ── Error ──────────────────────────────────────────────── */}
          {state?.error && (
            <p className="text-sm text-red-500 text-center">{state.error}</p>
          )}

          {/* ── Submit ─────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={pending || isCompressing}
            className="
              w-full py-4 rounded-2xl mt-2
              bg-primary text-white font-bold text-[15px]
              hover:brightness-110 active:scale-[0.98]
              transition-all disabled:opacity-60 disabled:cursor-not-allowed
              shadow-[0_4px_24px_rgba(93,42,66,0.40)]
            "
          >
            {isCompressing
              ? "جاري ضغط الصور…"
              : pending
              ? "جاري الرفع..."
              : "نشر الإعلان"
            }
          </button>

        </div>{/* end right column */}
      </div>{/* end grid */}
      </form>
      </div>
    </div>
  );
}
