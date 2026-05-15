"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, Loader2, Search, ShieldAlert, X } from "lucide-react";
import { createListingAction } from "@/app/actions/product";
import PageHeader from "@/components/PageHeader";
import { SUB_CATEGORIES } from "@/lib/subcategories";
import { BRANDS, SEARCHABLE_BRANDS as _SEARCHABLE_BRANDS } from "@/lib/brands";
import { createClient } from "@/lib/supabase/client";

const MAX_RAW_FILE_BYTES = 20 * 1024 * 1024;

type ImageEntry = {
  preview: string;
  rawPath: string | null;
  uploading: boolean;
  error: boolean;
};

/* ── Data ────────────────────────────────────────────────────────────────── */

const CATEGORIES = [
  "فساتين", "أحذية", "حقائب", "إكسسوارات",
  "ملابس رجالية", "ملابس أطفال", "ملابس رياضية", "ملابس تقليدية", "أخرى",
];

const CONDITIONS = ["جديد بالعلامة", "كالجديد", "مستعمل - حالة جيدة", "مستعمل - حالة مقبولة"];

const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const CLOTHING_NUM_SIZES = Array.from({ length: 12 }, (_, i) => String(34 + i * 2));
const SHOE_SIZES = Array.from({ length: 10 }, (_, i) => String(36 + i));

const CATEGORY_FEATURED_BRANDS: Record<string, string[]> = {
  "فساتين":         ["Zara", "Sherri Hill", "Gizia", "Monsoon", "Mango", "H&M"],
  "أحذية":          ["Dune", "Steve Madden", "Zara", "Aldo", "Nine West", "Michael Kors"],
  "حقائب":          ["Michael Kors", "Coach", "Louis Vuitton", "Zara", "Kate Spade", "Guess"],
  "إكسسوارات":     ["Swarovski", "Pandora", "Michael Kors", "DKNY", "Rado", "Fossil"],
  "ملابس رجالية":  ["Zara", "Ralph Lauren", "Tommy Hilfiger", "Lacoste", "Calvin Klein", "H&M"],
  "ملابس أطفال":   ["Zara", "H&M", "Next", "Marks & Spencer", "Mothercare", "Carter's"],
  "ملابس رياضية":  ["Nike", "Adidas", "Puma", "Under Armour", "Reebok", "Champion"],
  "ملابس تقليدية": ["Gizia", "Zara", "Mango"],
  "أخرى":           ["Zara", "H&M", "Mango", "Gizia", "Monsoon", "Michael Kors"],
};

const BRANDS_MAP = Object.fromEntries(BRANDS.map((b) => [b.value, b]));
const OTHER_BRAND = BRANDS_MAP["Other"];
const SEARCHABLE_BRANDS = _SEARCHABLE_BRANDS;

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

  const [entries,      setEntries]      = useState<ImageEntry[]>([]);
  const [uploadError,  setUploadError]  = useState<string | null>(null);

  const [title,        setTitle]        = useState("");
  const [price,        setPrice]        = useState("");
  const [negotiable,   setNegotiable]   = useState(false);
  const [category,     setCategory]     = useState("");
  const [subcategory,  setSubcategory]  = useState("");
  const [brand,        setBrand]        = useState("");
  const [brandQuery,   setBrandQuery]   = useState("");
  const [comboOpen,    setComboOpen]    = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [size,         setSize]         = useState("");
  const [condition,    setCondition]    = useState("");
  const [color,        setColor]        = useState("");
  const [city,         setCity]         = useState("");
  const [deliveryAvail, setDeliveryAvail] = useState(false);
  const [description,  setDescription]  = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabaseRef  = useRef(createClient());
  const comboRef     = useRef<HTMLDivElement>(null);
  const itemRefs     = useRef<(HTMLLIElement | null)[]>([]);

  const isUploading = entries.some((e) => e.uploading);

  /* ── Combobox: close on outside click ─────────────────────────────────── */
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setComboOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  /* ── Combobox: scroll highlighted item into view ─────────────────────── */
  useEffect(() => {
    if (highlightIdx >= 0) {
      itemRefs.current[highlightIdx]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  /* ── Image upload ────────────────────────────────────────────────────── */
  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    setUploadError(null);

    const oversized = files.find((f) => f.size > MAX_RAW_FILE_BYTES);
    if (oversized) {
      setUploadError(`حجم الصورة كبير جداً (${(oversized.size / 1024 / 1024).toFixed(1)} MB). الحد الأقصى 20 ميغابايت.`);
      return;
    }

    const supabase = supabaseRef.current;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUploadError("انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.");
      return;
    }

    const baseIndex = entries.length;
    const placeholders: ImageEntry[] = files.map((f) => ({
      preview:   URL.createObjectURL(f),
      rawPath:   null,
      uploading: true,
      error:     false,
    }));
    setEntries((prev) => [...prev, ...placeholders]);

    await Promise.all(files.map(async (file, i) => {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const rawPath = `raw/${user.id}/${uid}.${safeExt}`;

      const { error } = await supabase.storage
        .from("product-images")
        .upload(rawPath, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      setEntries((prev) => {
        const next = [...prev];
        const slot = baseIndex + i;
        if (!next[slot]) return prev;
        next[slot] = error
          ? { ...next[slot], uploading: false, error: true,  rawPath: null }
          : { ...next[slot], uploading: false, error: false, rawPath      };
        return next;
      });

      if (error) {
        console.error("[SellForm] storage upload error:", error);
        setUploadError("تعذّر رفع الصورة. تحقق من اتصال الإنترنت ثم حاول مرة أخرى.");
      }
    }));
  }

  function removeImage(index: number) {
    setEntries((prev) => {
      const target = prev[index];
      if (!target) return prev;
      URL.revokeObjectURL(target.preview);
      if (target.rawPath) {
        supabaseRef.current.storage
          .from("product-images")
          .remove([target.rawPath])
          .catch(() => { /* ignored */ });
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  /* ── Category ────────────────────────────────────────────────────────── */
  const isOneSize = category === "حقائب" || category === "إكسسوارات";
  const sizeType  = category === "أحذية" ? "numbers" : isOneSize ? "one-size" : "letters";

  function handleCategoryChange(newCat: string) {
    setCategory(newCat);
    setSubcategory("");
    setBrand("");
    setBrandQuery("");
    setComboOpen(false);
    setHighlightIdx(-1);
    const autoOneSize = newCat === "حقائب" || newCat === "إكسسوارات";
    setSize(autoOneSize ? "مقاس واحد" : "");
  }

  /* ── Brand combobox ──────────────────────────────────────────────────── */
  const featuredValues: string[] = category ? (CATEGORY_FEATURED_BRANDS[category] ?? []) : [];

  const filteredDropdownBrands = (() => {
    const q = brandQuery.trim().toLowerCase();
    const filtered = q
      ? SEARCHABLE_BRANDS.filter(
          (b) => b.label.includes(q) || b.value.toLowerCase().includes(q)
        )
      : SEARCHABLE_BRANDS;
    return [...filtered, OTHER_BRAND];
  })();

  function handleBrandPillClick(value: string) {
    setBrand((prev) => (prev === value ? "" : value));
    setBrandQuery("");
    setComboOpen(false);
    setHighlightIdx(-1);
  }

  function handleBrandQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setBrandQuery(e.target.value);
    setBrand("");
    setComboOpen(true);
    setHighlightIdx(-1);
  }

  function selectBrandFromCombo(item: { value: string; label: string }) {
    setBrand(item.value);
    setBrandQuery(item.label);
    setComboOpen(false);
    setHighlightIdx(-1);
  }

  function handleBrandKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setComboOpen(true);
      setHighlightIdx((i) => Math.min(i + 1, filteredDropdownBrands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const item = filteredDropdownBrands[highlightIdx];
      if (item) { e.preventDefault(); selectBrandFromCombo(item); }
    } else if (e.key === "Escape") {
      setComboOpen(false);
    }
  }

  /* ── Submit ──────────────────────────────────────────────────────────── */
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isUploading) {
      setUploadError("يرجى الانتظار حتى انتهاء رفع الصور.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    entries.forEach((entry) => {
      if (entry.rawPath) fd.append("raw_paths", entry.rawPath);
    });
    startTransition(() => formAction(fd));
  }

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 pb-32">

      <PageHeader title="بيع منتج جديد" />

      <div className="md:max-w-5xl mx-auto md:mt-8 md:mb-12">
      <form className="px-4 pt-6" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative">

        {/* ── Left column: Image upload ─────────────────────────────── */}
        <div className="md:col-span-5 md:sticky top-28">
          <p className={fieldLabel}>الصور</p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg, image/png, image/webp"
            className="hidden"
            onChange={handleImageChange}
          />

          <label
            htmlFor="image-upload"
            onClick={() => fileInputRef.current?.click()}
            className="
              relative w-full aspect-video rounded-2xl
              border-2 border-dashed border-border bg-muted
              flex flex-col items-center justify-center gap-3
              transition-all duration-200
              hover:border-primary/50 hover:bg-primary/5 cursor-pointer
            "
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">رفع صور المنتج</p>
              <p className="text-xs text-muted-foreground mt-1">اضغط لإضافة حتى ٨ صور</p>
            </div>
            {isUploading && (
              <p className="text-xs font-medium text-primary mt-1 flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                جاري رفع الصور…
              </p>
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

          {entries.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
              {entries.map((entry, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.preview}
                    alt=""
                    className={`w-full h-full object-cover ${entry.uploading ? "opacity-60" : ""}`}
                  />
                  {entry.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                  {entry.error && !entry.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-500/40 text-white text-[11px] font-bold text-center px-2">
                      فشل الرفع
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="
                      absolute top-1 left-1 w-6 h-6 rounded-full
                      bg-red-500 text-white flex items-center justify-center
                      shadow-md hover:bg-red-600 transition-colors
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

          {/* ── Card 1: Basic Info ────────────────────────────────── */}
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 mb-6">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-1 border-b border-gray-100">
              المعلومات الأساسية
            </h3>

            {/* Title */}
            <div>
              <label htmlFor="title" className={fieldLabel}>عنوان الإعلان</label>
              <input
                id="title" name="title" type="text"
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: معطف زارا أزرق مقاس M"
                dir="rtl" required className={input}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className={fieldLabel}>الفئة</label>
              <div className="relative">
                <select
                  id="category" name="category"
                  value={category} onChange={(e) => handleCategoryChange(e.target.value)}
                  dir="rtl" required
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

            {/* Sub-category pills */}
            {category && SUB_CATEGORIES[category] && (
              <div>
                <p className={fieldLabel}>
                  الفئة الفرعية{" "}
                  <span className="font-normal text-muted-foreground text-xs">(اختياري)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUB_CATEGORIES[category].map((sub) => (
                    <button
                      key={sub} type="button"
                      onClick={() => setSubcategory(sub === subcategory ? "" : sub)}
                      className={pill(subcategory === sub)}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Brand ─────────────────────────────────────────── */}
            <div>
              <p className={fieldLabel}>الماركة</p>

              {/* Always-visible pills: Custom Made + category featured */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => handleBrandPillClick("Custom Made")}
                  className={pill(brand === "Custom Made")}
                >
                  تفصيل
                </button>

                {featuredValues.map((bv) => {
                  const item = BRANDS_MAP[bv];
                  if (!item) return null;
                  return (
                    <button
                      key={bv} type="button"
                      onClick={() => handleBrandPillClick(bv)}
                      className={pill(brand === bv)}
                    >
                      {item.label}
                    </button>
                  );
                })}

                {!category && (
                  <span className="text-xs text-muted-foreground self-center pr-1">
                    اختر الفئة لعرض الماركات المقترحة
                  </span>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground shrink-0">أو ابحث عن ماركة أخرى</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Combobox */}
              <div ref={comboRef} className="relative">
                <div className="
                  w-full rounded-xl border border-border bg-card px-4 py-3.5
                  flex items-center gap-2
                  focus-within:border-primary transition-colors
                ">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={brandQuery}
                    onChange={handleBrandQueryChange}
                    onFocus={() => setComboOpen(true)}
                    onKeyDown={handleBrandKeyDown}
                    placeholder="مثال: نايك، مايكل كورس، زارا…"
                    className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                    dir="rtl"
                    autoComplete="off"
                  />
                  {brandQuery && (
                    <button
                      type="button"
                      onClick={() => { setBrandQuery(""); setBrand(""); setHighlightIdx(-1); }}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {comboOpen && filteredDropdownBrands.length > 0 && (
                  <ul
                    role="listbox"
                    className="absolute top-full right-0 left-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto z-20"
                  >
                    {filteredDropdownBrands.map((b, i) => (
                      <li
                        key={b.value}
                        role="option"
                        aria-selected={brand === b.value}
                        ref={(el) => { itemRefs.current[i] = el; }}
                        onMouseDown={(e) => { e.preventDefault(); selectBrandFromCombo(b); }}
                        onMouseEnter={() => setHighlightIdx(i)}
                        className={`
                          px-4 py-2.5 text-sm cursor-pointer select-none
                          ${brand === b.value ? "text-primary font-semibold" : "text-foreground"}
                          ${i === highlightIdx ? "bg-primary/10" : "hover:bg-muted"}
                          ${b.value === "Other" ? "border-t border-border mt-1" : ""}
                        `}
                      >
                        {b.label}
                      </li>
                    ))}
                  </ul>
                )}
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
                  id="color" name="color"
                  value={color} onChange={(e) => setColor(e.target.value)}
                  dir="rtl"
                  className={`${input} appearance-none cursor-pointer`}
                >
                  <option value="">اختر اللون</option>
                  {["أسود","أبيض","رمادي","بيج","بني","أزرق","أخضر","أحمر","وردي","برتقالي","أصفر","بنفسجي","ذهبي","فضي","متعدد الألوان"].map((c) => (
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
                    value={size} onChange={(e) => setSize(e.target.value)}
                    dir="rtl" required
                    className={`${input} appearance-none cursor-pointer`}
                  >
                    <option value="" disabled>اختر المقاس</option>
                    {category === "أحذية" ? (
                      SHOE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)
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
                    key={c} type="button"
                    onClick={() => setCondition(c === condition ? "" : c)}
                    className={`
                      py-3 px-3 rounded-xl text-xs font-semibold border text-center transition-all
                      ${condition === c
                        ? "bg-primary text-white border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/50"}
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
                  id="price" name="price" type="number" inputMode="decimal"
                  value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder="0" dir="rtl" required min="0"
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
                role="switch" aria-checked={negotiable}
                onClick={() => setNegotiable((n) => !n)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${negotiable ? "bg-primary" : "bg-border"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${negotiable ? "-translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </label>

            {/* City */}
            <div>
              <label htmlFor="city" className={fieldLabel}>المدينة</label>
              <div className="relative">
                <select
                  id="city" name="city"
                  value={city} onChange={(e) => setCity(e.target.value)}
                  dir="rtl"
                  className={`${input} appearance-none cursor-pointer`}
                >
                  <option value="">اختر المدينة</option>
                  {["طرابلس","بنغازي","مصراتة","الزاوية","البيضاء","سبها","الزنتان","زوارة","غريان","ترهونة","الخمس","سرت","درنة","توبرق"].map((c) => (
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
                role="switch" aria-checked={deliveryAvail}
                onClick={() => setDeliveryAvail((d) => !d)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${deliveryAvail ? "bg-primary" : "bg-border"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${deliveryAvail ? "-translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </label>

            {/* Description */}
            <div>
              <label htmlFor="description" className={fieldLabel}>الوصف</label>
              <textarea
                id="description" name="description"
                value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="اكتب تفاصيل المنتج، سبب البيع، أي عيوب إن وجدت…"
                dir="rtl" rows={4} maxLength={500}
                className={`${input} resize-none leading-relaxed`}
              />
              <p className="text-xs text-muted-foreground mt-1.5 text-left">
                {description.length} / 500
              </p>
            </div>
          </div>

          {/* ── Hidden inputs ──────────────────────────────────────── */}
          <input type="hidden" name="brand"              value={brand} />
          <input type="hidden" name="subcategory"        value={subcategory} />
          <input type="hidden" name="size_type"          value={sizeType} />
          {isOneSize && <input type="hidden" name="size_value" value="مقاس واحد" />}
          <input type="hidden" name="condition"          value={condition} />
          <input type="hidden" name="is_open_to_offers"  value={String(negotiable)} />
          <input type="hidden" name="delivery_available" value={String(deliveryAvail)} />

          {uploadError && (
            <p className="text-sm text-red-500 text-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {uploadError}
            </p>
          )}

          {state?.error && (
            <p className="text-sm text-red-500 text-center">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending || isUploading}
            className="
              w-full py-4 rounded-2xl mt-2
              bg-primary text-white font-bold text-[15px]
              hover:brightness-110 active:scale-[0.98]
              transition-all disabled:opacity-60 disabled:cursor-not-allowed
              shadow-[0_4px_24px_rgba(93,42,66,0.40)]
            "
          >
            {isUploading ? "جاري رفع الصور…" : pending ? "جاري المعالجة والنشر…" : "نشر الإعلان"}
          </button>

        </div>
      </div>
      </form>
      </div>
    </div>
  );
}
