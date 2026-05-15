import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import FavoriteButton from "@/components/FavoriteButton";
import { BRAND_LABEL } from "@/lib/brands";

/* ── Static data ─────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { label: "فساتين",         href: "/search?category=فساتين",         image: "/category-dress.png"         },
  { label: "أحذية",          href: "/search?category=أحذية",          image: "/category-shoes.webp"        },
  { label: "حقائب",          href: "/search?category=حقائب",          image: "/category-bag.jpg"           },
  { label: "إكسسوارات",      href: "/search?category=إكسسوارات",      image: "/category-accessories.png"  },
  { label: "أزياء تقليدية",  href: "/search?category=traditional",    image: "/category-traditional.jpg"  },
  { label: "ملابس أطفال",    href: "/search?category=kids",           image: "/category-baby.png"         },
];

const BRANDS = [
  { name: "زارا",       logo: "/brands/zara.png",        href: "/search?brand=zara"        },
  { name: "مونسون",     logo: "/brands/monsoon.png",     href: "/search?brand=monsoon"     },
  { name: "ديون",       logo: "/brands/dune.png",        href: "/search?brand=dune"        },
  { name: "شيري هيل",   logo: "/brands/sherri-hill.png", href: "/search?brand=sherri-hill" },
  { name: "مايكل كورس", logo: "/brands/michael-kors.png", href: "/search?brand=michael-kors" },
  { name: "جيزيا",      logo: "/brands/gizia.png",       href: "/search?brand=gizia"       },
];


/* ── Helpers ─────────────────────────────────────────────────────────────── */

function SectionHeading({
  title,
  viewAllHref,
}: {
  title: string;
  viewAllHref?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-6">
      <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-none">
        {title}
      </h2>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="text-xs font-semibold text-primary hover:underline underline-offset-4 shrink-0 mb-0.5"
        >
          عرض الكل ←
        </Link>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default async function Home() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("id, title, price, brand, size_value, image_urls")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  const products = data ?? [];

  const { data: { user } } = await supabase.auth.getUser();
  let favIds = new Set<string>();
  if (user) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", user.id);
    favIds = new Set((favs ?? []).map((f) => f.product_id as string));
  }

  return (
    <div dir="rtl" className="flex flex-col min-h-screen bg-background">

      <main className="flex flex-col gap-14 md:gap-20 pt-4 md:pt-6 pb-20">

        {/* ── Hero + overlapping search pill ───────────────────────── */}
        <div className="px-4 md:px-8 lg:px-16 max-w-7xl mx-auto w-full">

          {/* Image banner */}
          <div className="relative w-full overflow-hidden rounded-[2rem] min-h-[400px] flex items-center justify-center md:min-h-[600px] md:justify-start">
            <Image
              src="/hero-bg.jpg"
              alt="Hero"
              fill
              className="object-cover object-center"
              priority
            />
            <div className="absolute inset-0 bg-black/50" />

            {/* Mobile: centered. Desktop: mr-auto pushes block to the left in RTL */}
            <div className="relative z-10 w-full px-6 py-14 flex flex-col items-center text-center md:max-w-lg md:mr-auto md:px-12 md:items-start md:text-right">
              <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-3">
                جدّدي خزانة ملابسك
              </h1>
              <p className="text-[15px] text-white/75 leading-relaxed">
                بيع واشتري أجمل الأزياء المستعملة في ليبيا بسهولة وأمان.
              </p>
              <div className="flex flex-col gap-4 mt-6 w-full max-w-xs sm:max-w-sm md:max-w-none md:flex-row md:justify-start">
                <Link
                  href="/sell"
                  className="
                    w-full md:w-auto
                    py-3.5 px-10 rounded-xl text-center
                    bg-primary text-white font-bold text-sm
                    hover:brightness-110 active:scale-[0.98]
                    transition-all
                  "
                >
                  ابدأ البيع الآن
                </Link>
                <Link
                  href="/search"
                  className="
                    text-sm text-white/75 font-semibold
                    underline underline-offset-[3px] decoration-white/40
                    hover:text-white hover:decoration-white
                    transition-colors py-1 self-center
                  "
                >
                  تصفح أحدث الإضافات
                </Link>
              </div>
            </div>
          </div>

          {/* Search pill — z-20 so it floats above the hero's rounded bottom edge */}
          <div className="relative z-20 -mt-6">
            <form
              action="/search"
              className="
                flex items-center gap-3
                rounded-full bg-white shadow-md
                px-6 py-3.5
                hover:shadow-lg focus-within:shadow-lg focus-within:ring-2 focus-within:ring-primary/20
                transition-shadow
              "
            >
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                name="q"
                type="text"
                dir="rtl"
                placeholder="ابحث في دولابي..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-gray-400 outline-none text-right"
              />
            </form>
          </div>

        </div>

        {/* ── Section 1: Shop by Category ───────────────────────────── */}
        <section className="px-4 md:px-8 lg:px-16">
          <SectionHeading title="تسوق حسب الفئة" />

          <div className="grid grid-rows-2 md:grid-rows-1 grid-flow-col gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory pb-8 w-full [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.label}
                href={cat.href}
                className="group w-40 md:w-56 lg:w-64 snap-start relative rounded-xl overflow-hidden aspect-[4/5] shrink-0"
              >
                {/* Photo with plum tint */}
                <div className="absolute inset-0 after:absolute after:inset-0 after:bg-[#581c3c]/20 after:mix-blend-multiply">
                  <Image
                    src={cat.image}
                    alt={cat.label}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Category label — bottom-right, inside image */}
                <span className="
                  absolute bottom-4 right-4 z-10
                  text-white text-xl md:text-2xl font-extrabold
                  drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]
                  leading-none
                ">
                  {cat.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Section 2: Recently Added carousel ────────────────────── */}
        <section>
          <div className="px-4 md:px-8 lg:px-16">
            <SectionHeading title="أحدث الإضافات" viewAllHref="/search" />
          </div>

          {products.length === 0 ? (
            /* ── Empty state ──────────────────────────────────────────── */
            <div className="px-4 md:px-8 lg:px-16">
              <div className="flex flex-col items-center justify-center text-center py-16 rounded-2xl border border-dashed border-border bg-muted/30 gap-4">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground mb-1">
                    لا توجد معروضات متاحة حالياً
                  </p>
                  <p className="text-sm text-muted-foreground">كن أول من يبيع في دولابي!</p>
                </div>
                <Link
                  href="/sell"
                  className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-sm hover:brightness-110 transition-all"
                >
                  أضف منتجك الأول
                </Link>
              </div>
            </div>
          ) : (
            <div className="
              flex gap-3 md:gap-4
              overflow-x-auto scrollbar-hide
              snap-x snap-mandatory
              px-4 md:px-8 lg:px-16
              pb-2
            ">
              {products.map((p) => {
                const img = p.image_urls?.[0] ?? null;
                return (
                  <div
                    key={p.id}
                    className="snap-start shrink-0 w-[148px] md:w-[188px] group flex flex-col"
                  >
                    {/* Product image */}
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden mb-3 bg-muted">
                      <Link href={`/product/${p.id}`} className="block w-full h-full">
                        {img ? (
                          <Image
                            src={img}
                            alt={`${p.brand} — ${p.title}`}
                            fill
                            unoptimized
                            sizes="188px"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                      </Link>
                      <div className="absolute top-2 left-2">
                        <FavoriteButton
                          productId={p.id}
                          initialIsFavorited={favIds.has(p.id)}
                        />
                      </div>
                    </div>

                    <Link href={`/product/${p.id}`} className="flex flex-col">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">
                        {BRAND_LABEL[p.brand] ?? p.brand}
                      </p>
                      <p className="text-sm font-medium text-foreground line-clamp-1 mb-2">
                        {p.title}
                      </p>

                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-sm font-bold text-foreground">
                          {p.price}{" "}
                          <span className="text-xs font-normal text-muted-foreground">د.ل</span>
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">
                          {p.size_value}
                        </span>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Section 3: Popular Brands ──────────────────────────────── */}
        <section className="px-4 md:px-8 lg:px-16">
          <SectionHeading title="أشهر الماركات" viewAllHref="/search?sort=brand" />

          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 md:gap-6">
            {BRANDS.map((brand) => (
              <Link
                key={brand.name}
                href={brand.href}
                className="flex flex-col items-center gap-2.5 group"
              >
                <div className="
                  w-16 h-16 md:w-20 md:h-20
                  rounded-2xl border border-border bg-muted
                  flex items-center justify-center overflow-hidden
                  group-hover:border-primary group-hover:bg-primary/5
                  transition-all duration-200
                ">
                  <Image
                    src={brand.logo}
                    alt={brand.name}
                    width={80}
                    height={80}
                    className="w-full h-full object-contain p-2"
                  />
                </div>
                <span className="text-xs font-semibold text-foreground">{brand.name}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* ── Sell CTA ──────────────────────────────────────────────────── */}
      <footer className="mt-auto py-14 px-4 bg-primary text-center" dir="rtl">
        <h2 className="text-2xl font-bold text-white mb-2">دولابك فيه ذهب!</h2>
        <p className="text-white/70 text-sm mb-7 leading-relaxed">
          الملابس التي لم تعد ترتديها قد تكون حلم شخص آخر.
          <br />
          ابدأ البيع اليوم مجاناً.
        </p>
        <Link
          href="/sell"
          className="inline-block px-8 py-3.5 rounded-full bg-white text-primary font-bold text-sm hover:bg-muted transition-colors shadow-sm"
        >
          ابدأ البيع الآن
        </Link>
      </footer>
    </div>
  );
}
