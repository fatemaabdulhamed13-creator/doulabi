"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const CATEGORIES = [
  "فساتين", "أحذية", "حقائب", "إكسسوارات",
  "ملابس رجالية", "ملابس أطفال", "ملابس رياضية", "أخرى",
];

const BRANDS = [
  { value: "Zara",         label: "زارا"       },
  { value: "Monsoon",      label: "مونسون"     },
  { value: "Dune",         label: "ديون"       },
  { value: "Sherri Hill",  label: "شيري هيل"   },
  { value: "Michael Kors", label: "مايكل كورس" },
  { value: "Gizia",        label: "جيزيا"      },
  { value: "Other",        label: "أخرى"       },
];

const LETTER_SIZES       = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const CLOTHING_NUM_SIZES = Array.from({ length: 8 },  (_, i) => String(34 + i * 2));
const SHOE_SIZES         = Array.from({ length: 10 }, (_, i) => String(36 + i));

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

const sel =
  "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground " +
  "appearance-none cursor-pointer focus:outline-none focus:border-primary transition-colors";

const numInput =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

export default function SearchFilters() {
  const router = useRouter();
  const sp     = useSearchParams();

  const [q,        setQ]        = useState(sp.get("q")        ?? "");
  const [category, setCategory] = useState(sp.get("category") ?? "");
  const [size,     setSize]     = useState(sp.get("size")     ?? "");
  const [minPrice, setMinPrice] = useState(sp.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(sp.get("maxPrice") ?? "");
  const [color,    setColor]    = useState(sp.get("color")    ?? "");
  const [city,     setCity]     = useState(sp.get("city")     ?? "");
  const [brand,    setBrand]    = useState(sp.get("brand")    ?? "");
  const [delivery, setDelivery] = useState(sp.get("delivery") === "true");

  const isOneSize = category === "حقائب" || category === "إكسسوارات";

  function handleCategoryChange(newCat: string) {
    setCategory(newCat);
    const autoOneSize = newCat === "حقائب" || newCat === "إكسسوارات";
    setSize(autoOneSize ? "مقاس واحد" : "");
  }

  const hasFilters = !!(q || category || size || minPrice || maxPrice || color || city || brand || delivery);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q)        p.set("q",        q);
    if (category) p.set("category", category);
    if (size)     p.set("size",     size);
    if (minPrice) p.set("minPrice", minPrice);
    if (maxPrice) p.set("maxPrice", maxPrice);
    if (color)    p.set("color",    color);
    if (city)     p.set("city",     city);
    if (brand)    p.set("brand",    brand);
    if (delivery) p.set("delivery", "true");
    router.push(`/search?${p.toString()}`);
  }

  function reset() {
    setQ(""); setCategory(""); setSize(""); setMinPrice(""); setMaxPrice("");
    setColor(""); setCity(""); setBrand(""); setDelivery(false);
    router.push("/search");
  }

  return (
    <form onSubmit={apply} dir="rtl" className="flex flex-col gap-4">

      {/* Keyword search */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">بحث</label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          dir="rtl"
          placeholder="ابحث عن ماركة، ستايل، أو اسم..."
          className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">الفئة</label>
        <div className="relative">
          <select value={category} onChange={(e) => handleCategoryChange(e.target.value)} dir="rtl" className={sel}>
            <option value="">الكل</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* City */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">المدينة</label>
        <div className="relative">
          <select value={city} onChange={(e) => setCity(e.target.value)} dir="rtl" className={sel}>
            <option value="">الكل</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Brand */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">الماركة</label>
        <div className="relative">
          <select value={brand} onChange={(e) => setBrand(e.target.value)} dir="rtl" className={sel}>
            <option value="">الكل</option>
            {BRANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Size */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">المقاس</label>

        {isOneSize ? (
          <div className={`${sel} text-muted-foreground cursor-default`}>مقاس واحد</div>
        ) : (
          <div className="relative">
            <select value={size} onChange={(e) => setSize(e.target.value)} dir="rtl" className={sel}>
              <option value="">الكل</option>
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
            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>

      {/* Color */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">اللون</label>
        <div className="relative">
          <select value={color} onChange={(e) => setColor(e.target.value)} dir="rtl" className={sel}>
            <option value="">الكل</option>
            {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Price range */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">السعر (د.ل)</p>
        <div className="flex items-center gap-1.5">
          <input type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="من" className={numInput} />
          <span className="text-muted-foreground shrink-0 text-xs">—</span>
          <input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="إلى" className={numInput} />
        </div>
      </div>

      {/* Delivery checkbox */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <div
          role="checkbox"
          aria-checked={delivery}
          onClick={() => setDelivery((d) => !d)}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
            delivery ? "bg-primary border-primary" : "border-border bg-card group-hover:border-primary/50"
          }`}
        >
          {delivery && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="text-sm text-foreground">توصيل خارج المدينة</span>
      </label>

      {/* Buttons */}
      <button
        type="submit"
        className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all mt-1"
      >
        تطبيق الفلاتر
      </button>

      {hasFilters && (
        <button
          type="button"
          onClick={reset}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
        >
          إزالة الفلاتر
        </button>
      )}
    </form>
  );
}
