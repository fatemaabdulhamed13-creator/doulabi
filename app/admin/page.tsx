import Image from "next/image";
import { redirect } from "next/navigation";
import { CheckCircle, ClipboardList, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { approveProductAction, rejectProductAction } from "@/app/actions/product";

/* ── Types ───────────────────────────────────────────────────────────────── */

type PendingProduct = {
  id:               string;
  title:            string;
  price:            number;
  category:         string;
  brand:            string;
  size_type:        string;
  size_value:       string;
  condition:        string;
  description:      string | null;
  image_urls:       string[];
  created_at:       string;
  profiles: {
    full_name:       string;
    whatsapp_number: string;
  } | null;
};

/* ── Page ────────────────────────────────────────────────────────────────── */

export default async function AdminPage() {
  const supabase = await createClient();

  // ── Security gate ───────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) redirect('/');

  // ── Fetch pending products with seller info ─────────────────────────────
  const { data: products } = await supabase
    .from('products')
    .select(`
      id, title, price, category, brand,
      size_type, size_value, condition,
      description, image_urls, created_at,
      profiles ( full_name, whatsapp_number )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .returns<PendingProduct[]>();

  const pending = products ?? [];

  return (
    <div dir="rtl" className="min-h-screen bg-background">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-6 h-14 flex items-center gap-3">
        <ClipboardList className="h-5 w-5 text-primary shrink-0" />
        <h1 className="text-base font-bold text-foreground">لوحة الإدارة</h1>
        <span className="mr-auto text-xs font-medium text-muted-foreground">
          {pending.length > 0
            ? `${pending.length} منتج بانتظار المراجعة`
            : 'لا توجد منتجات معلقة'}
        </span>
      </header>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto p-4 md:p-8">

        {pending.length === 0 ? (
          /* ── Empty state ─────────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center text-center py-24 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ClipboardList className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-semibold text-foreground">لا توجد منتجات بانتظار المراجعة</p>
            <p className="text-sm text-muted-foreground">كل شيء على ما يرام — عد لاحقاً.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.map((product) => {
              const approve  = approveProductAction.bind(null, product.id);
              const reject   = rejectProductAction.bind(null, product.id);
              const postedAt = new Date(product.created_at).toLocaleDateString('ar-LY', {
                year: 'numeric', month: 'short', day: 'numeric',
              });

              return (
                <article
                  key={product.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col gap-0"
                >
                  {/* ── Image strip ───────────────────────────────────── */}
                  {product.image_urls.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto p-3 bg-muted/40 border-b border-border scrollbar-none">
                      {product.image_urls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative shrink-0 w-36 h-36 rounded-xl overflow-hidden bg-muted ring-1 ring-border hover:ring-primary transition-all"
                        >
                          <Image
                            src={url}
                            alt={`${product.title} — صورة ${idx + 1}`}
                            fill
                            unoptimized
                            sizes="144px"
                            className="object-cover hover:scale-105 transition-transform duration-200"
                          />
                          {idx === 0 && (
                            <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              رئيسية
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="h-20 bg-muted/40 border-b border-border flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">لا توجد صور</span>
                    </div>
                  )}

                  {/* ── Details ───────────────────────────────────────── */}
                  <div className="flex flex-1 flex-col md:flex-row gap-4 p-4 md:p-5">

                    {/* Info block */}
                    <div className="flex-1 flex flex-col gap-2.5 min-w-0">

                      {/* Title + price */}
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-base font-bold text-foreground leading-snug">
                          {product.title}
                        </h2>
                        <span className="shrink-0 text-base font-black text-primary">
                          {product.price}{" "}
                          <span className="text-xs font-normal text-muted-foreground">د.ل</span>
                        </span>
                      </div>

                      {/* Meta pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          product.category,
                          product.brand,
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

                    {/* ── Action buttons ────────────────────────────────── */}
                    <div className="flex md:flex-col gap-2 shrink-0 md:justify-center">
                      <form action={approve} className="flex-1 md:flex-none">
                        <button
                          type="submit"
                          className="
                            w-full md:w-32 flex items-center justify-center gap-1.5
                            py-2.5 px-4 rounded-xl
                            bg-emerald-500 hover:bg-emerald-600
                            text-white font-bold text-sm
                            active:scale-[0.97] transition-all
                          "
                        >
                          <CheckCircle className="h-4 w-4 shrink-0" />
                          قبول
                        </button>
                      </form>

                      <form action={reject} className="flex-1 md:flex-none">
                        <button
                          type="submit"
                          className="
                            w-full md:w-32 flex items-center justify-center gap-1.5
                            py-2.5 px-4 rounded-xl
                            bg-red-500 hover:bg-red-600
                            text-white font-bold text-sm
                            active:scale-[0.97] transition-all
                          "
                        >
                          <XCircle className="h-4 w-4 shrink-0" />
                          رفض
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
