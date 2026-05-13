import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SearchFilters from "@/components/SearchFilters";
import MobileSearchBar from "@/components/MobileSearchBar";
import PageHeader from "@/components/PageHeader";
import { SUB_CATEGORIES } from "@/lib/subcategories";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type Product = {
  id:         string;
  title:      string;
  price:      number;
  brand:      string;
  size_value: string;
  image_urls: string[];
};

/** Maps the English brand value stored in the DB → Arabic display name */
const BRAND_AR: Record<string, string> = {
  Zara:          "زارا",
  Monsoon:       "مونسون",
  Dune:          "ديون",
  "Sherri Hill": "شيري هيل",
  "Michael Kors": "مايكل كورس",
  Gizia:         "جيزيا",
  Other:         "أخرى",
};

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;

  const q           = typeof sp.q           === "string" && sp.q        ? sp.q        : undefined;
  const category    = typeof sp.category    === "string" ? sp.category    : undefined;
  const subcategory = typeof sp.subcategory === "string" ? sp.subcategory : undefined;
  const size        = typeof sp.size        === "string" ? sp.size        : undefined;
  const minPrice    = typeof sp.minPrice    === "string" ? Number(sp.minPrice)  : undefined;
  const maxPrice    = typeof sp.maxPrice    === "string" ? Number(sp.maxPrice)  : undefined;
  const color       = typeof sp.color       === "string" ? sp.color       : undefined;
  const city        = typeof sp.city        === "string" ? sp.city        : undefined;
  const delivery    = sp.delivery === "true";

  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("id, title, price, brand, size_value, image_urls")
    .eq("status", "approved")
    .eq("is_sold", false);

  if (q)           query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (category)    query = query.eq("category",           category);
  if (subcategory) query = query.eq("subcategory", subcategory);
  if (size)        query = query.eq("size_value",          size);
  if (minPrice)    query = query.gte("price",              minPrice);
  if (maxPrice)    query = query.lte("price",              maxPrice);
  if (color)       query = query.eq("color",               color);
  if (city)        query = query.eq("city",                city);
  if (delivery)    query = query.eq("delivery_available",  true);

  const { data } = await query
    .order("created_at", { ascending: false })
    .returns<Product[]>();

  const products    = data ?? [];
  const isFiltered  = !!(q || category || size || minPrice || maxPrice || color || city || delivery);
  const heading     = category ?? "تصفح الكل";

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-32">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <PageHeader title={heading} />

      {/* ── Two-column layout ─────────────────────────────────────────── */}
      <div className="md:grid md:grid-cols-4 md:gap-6 md:px-8 md:py-6 max-w-7xl md:mx-auto md:items-start">

        {/* ── Filters sidebar (desktop) ─────────────────────────────── */}
        <aside className="hidden md:block md:col-span-1 sticky top-28 self-start max-h-[calc(100vh-8rem)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="text-sm font-bold text-foreground mb-5 pb-3 border-b border-border">
              الفلاتر
            </h2>
            <Suspense>
              <SearchFilters />
            </Suspense>
          </div>
        </aside>

        {/* ── Products column ───────────────────────────────────────── */}
        <main className="md:col-span-3 px-4 py-5 md:px-0 md:py-0">

          {/* Mobile search bar */}
          <Suspense>
            <MobileSearchBar />
          </Suspense>

          {/* Filters accordion (mobile only) */}
          <div className="md:hidden mb-5 bg-card rounded-2xl border border-border overflow-hidden">
            <details>
              <summary className="px-4 py-3.5 text-sm font-bold text-foreground cursor-pointer select-none">
                الفلاتر {isFiltered && <span className="text-primary text-xs font-normal mr-1">• مفعّل</span>}
              </summary>
              <div className="px-4 pb-4">
                <Suspense>
                  <SearchFilters />
                </Suspense>
              </div>
            </details>
          </div>

          {/* ── Sub-category pills ─────────────────────────────────── */}
          {category && SUB_CATEGORIES[category] && (
            <div
              dir="rtl"
              className="flex flex-wrap gap-2 mb-5"
              role="list"
              aria-label="تصفية حسب الفئة الفرعية"
            >
              {/* "All" pill — clears subcategory while keeping category */}
              <Link
                href={`/search?category=${encodeURIComponent(category)}`}
                role="listitem"
                className={`
                  inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold
                  border transition-colors duration-150 whitespace-nowrap
                  ${
                    !subcategory
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-background text-foreground border-border hover:border-primary hover:text-primary"
                  }
                `}
              >
                الكل
              </Link>

              {SUB_CATEGORIES[category].map((sub) => {
                const isActive = subcategory === sub;
                const href = `/search?category=${encodeURIComponent(category)}&subcategory=${encodeURIComponent(sub)}`;
                return (
                  <Link
                    key={sub}
                    href={href}
                    role="listitem"
                    className={`
                      inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold
                      border transition-colors duration-150 whitespace-nowrap
                      ${
                        isActive
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-background text-foreground border-border hover:border-primary hover:text-primary"
                      }
                    `}
                  >
                    {sub}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Result count */}
          <p className="text-xs text-muted-foreground mb-5">
            <span className="font-bold text-foreground">{products.length}</span>
            {" "}منتج
            {q           && <span className="text-foreground font-medium"> لـ &quot;{q}&quot;</span>}
            {subcategory && <span className="text-foreground font-medium"> في {subcategory}</span>}
            {category && !subcategory && <span className="text-foreground font-medium"> في {category}</span>}
          </p>

          {/* Empty state */}
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ShoppingBag className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground mb-1">
                  لا توجد نتائج تطابق بحثك
                </p>
                <p className="text-sm text-muted-foreground">جرب تغيير الفلاتر أو تصفح جميع المنتجات</p>
              </div>
              <Link
                href="/search"
                className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-sm hover:brightness-110 transition-all"
              >
                عرض الكل
              </Link>
            </div>
          ) : (
            /* Product grid */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => {
                const img = p.image_urls[0] ?? null;
                return (
                  <Link
                    key={p.id}
                    href={`/product/${p.id}`}
                    className="group flex flex-col gap-2"
                  >
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted">
                      {img ? (
                        <Image
                          src={img}
                          alt={`${p.brand} — ${p.title}`}
                          fill
                          unoptimized
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 px-0.5">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                        {BRAND_AR[p.brand] ?? p.brand}
                      </p>
                      <p className="text-sm font-semibold text-foreground line-clamp-1">
                        {p.title}
                      </p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-sm font-black text-foreground">
                          {p.price}{" "}
                          <span className="text-xs font-normal text-muted-foreground">د.ل</span>
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          {p.size_value}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
