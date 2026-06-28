import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FavoriteButton from "@/components/FavoriteButton";
import PageHeader from "@/components/PageHeader";

type FavoriteRow = {
  product_id: string;
  products: {
    id:         string;
    title:      string;
    price:      number;
    brand:      string;
    size_value: string;
    image_urls: string[];
  } | null;
};

const PAGE_SIZE = 12;

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page  = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const end   = page * PAGE_SIZE - 1;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("favorites")
    .select("product_id, products ( id, title, price, brand, size_value, image_urls )")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(start, end)
    .returns<FavoriteRow[]>();

  const favorites = (data ?? []).filter((f) => f.products !== null);
  const hasPrev   = page > 1;
  const hasNext   = favorites.length === PAGE_SIZE;

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-32">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <PageHeader title="مفضلاتي" />

      {/* ── Content ──────────────────────────────────────────────────── */}
      <main className="px-4 pt-6">
        {favorites.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {favorites.map(({ products: item }) => {
              if (!item) return null;
              const img = item.image_urls[0] ?? null;
              return (
                <div key={item.id} className="group flex flex-col gap-2">
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted">
                    <Link href={`/product/${item.id}`} className="block w-full h-full">
                      {img ? (
                        <Image
                          src={img}
                          alt={`${item.brand} — ${item.title}`}
                          fill
                          unoptimized
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Heart className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </Link>
                    <div className="absolute top-2 left-2">
                      <FavoriteButton productId={item.id} initialIsFavorited={true} />
                    </div>
                  </div>

                  <Link href={`/product/${item.id}`} className="flex flex-col gap-1 px-0.5">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                      {item.brand}
                    </p>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {item.title}
                    </p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-sm font-black text-foreground">
                        {item.price}{" "}
                        <span className="text-xs font-normal text-muted-foreground">د.ل</span>
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                        {item.size_value}
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Empty state ─────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center text-center py-20 px-4 md:max-w-md md:mx-auto">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <Heart className="h-9 w-9 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              لا توجد عناصر مفضلة بعد
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              العناصر التي تقوم بحفظها ستظهر هنا
            </p>
            <Link
              href="/"
              className="
                px-8 py-3.5 rounded-full
                bg-primary text-white font-bold text-sm
                hover:brightness-110 active:scale-[0.98]
                transition-all shadow-sm
              "
            >
              تصفح المنتجات
            </Link>
          </div>
        )}

        {/* ── Pagination controls ──────────────────────────────────── */}
        {(hasPrev || hasNext) && (
          <div className="flex items-center justify-center gap-4 mt-8">
            {hasPrev ? (
              <Link
                href={`/favorites?page=${page - 1}`}
                className="px-5 py-2 rounded-full border border-border bg-muted text-sm font-semibold text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all"
              >
                ← السابق
              </Link>
            ) : (
              <span className="px-5 py-2 rounded-full border border-border bg-muted text-sm font-semibold text-muted-foreground/40 cursor-not-allowed">
                ← السابق
              </span>
            )}

            <span className="text-sm text-muted-foreground font-medium">صفحة {page}</span>

            {hasNext ? (
              <Link
                href={`/favorites?page=${page + 1}`}
                className="px-5 py-2 rounded-full border border-border bg-muted text-sm font-semibold text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all"
              >
                التالي →
              </Link>
            ) : (
              <span className="px-5 py-2 rounded-full border border-border bg-muted text-sm font-semibold text-muted-foreground/40 cursor-not-allowed">
                التالي →
              </span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
