import React from "react";
import Link from "next/link";
import { ChevronLeft, Ruler, Sparkles, Tag, Layers, Truck, Palette, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductImagePanel from "@/components/product-image-panel";

type Props = {
  params: Promise<{ id: string }>;
};

type Product = {
  id:                 string;
  seller_id:          string;
  title:              string;
  price:              number;
  brand:              string;
  size_type:          string;
  size_value:         string;
  condition:          string;
  category:           string;
  description:        string | null;
  image_urls:         string[];
  is_open_to_offers:  boolean;
  color:              string | null;
  city:               string | null;
  delivery_available: boolean;
  profiles: {
    full_name:        string;
    whatsapp_number:  string;
  } | null;
};

/* ── WhatsApp CTA ────────────────────────────────────────────────────────── */

function WhatsAppCTA({ href }: { href: string }) {
  const isExternal = href.startsWith("http");
  return (
    <a
      href={href}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="
        flex items-center justify-center gap-3
        w-full py-4 rounded-2xl
        bg-primary text-white font-bold text-[15px]
        hover:brightness-110 active:scale-[0.98]
        transition-all
        shadow-[0_4px_24px_rgba(93,42,66,0.40)]
      "
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-white" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
      </svg>
      تواصل مع البائع عبر واتساب
    </a>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select(`
      id, seller_id, title, price, brand, size_type, size_value,
      condition, category, description, image_urls, is_open_to_offers,
      color, city, delivery_available,
      profiles ( full_name, whatsapp_number )
    `)
    .eq("id", id)
    .eq("status", "approved")
    .single<Product>();

  if (!product) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  let initialIsFavorited = false;
  if (user) {
    const { data: fav } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle();
    initialIsFavorited = !!fav;
  }

  const seller         = product.profiles;
  const sellerInitial  = seller?.full_name.charAt(0) ?? "؟";
  const whatsappHref   = seller?.whatsapp_number
    ? user
      ? `https://wa.me/${seller.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(
          `مرحباً، أنا مهتم بشراء: ${product.title}`
        )}`
      : `/signup?redirect=/product/${id}`
    : null;

  return (
    <div dir="rtl" className="min-h-screen bg-background">

      {/* ══════════════════════════════════════════════════════════════
          Desktop: two-column grid   Mobile: stacked
          ══════════════════════════════════════════════════════════════ */}
      <div className="md:grid md:grid-cols-2 md:gap-8 md:p-8 md:min-h-screen">

        {/* ── Left column: image ──────────────────────────────────── */}
        <div>
          <ProductImagePanel
            imageUrls={product.image_urls}
            title={product.title}
            productId={product.id}
            initialIsFavorited={initialIsFavorited}
          />
        </div>

        {/* ── Right column: details ───────────────────────────────── */}
        <div className="px-4 md:px-0 pb-56 md:pb-8">

          {/* Product info */}
          <section className="py-5 border-b border-border">
            <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-1.5">
              {product.brand}
            </p>
            <h1 className="text-xl font-bold text-foreground leading-snug mb-3">
              {product.title}
            </h1>
            <p className="text-3xl font-black text-foreground">
              {product.price}{" "}
              <span className="text-base font-normal text-muted-foreground">د.ل</span>
            </p>
            {product.is_open_to_offers && (
              <p className="text-xs font-semibold text-primary mt-2">قابل للتفاوض</p>
            )}
          </section>

          {/* Details grid */}
          <section>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 py-6 border-y border-gray-100">
              {([
                { label: "المقاس",  value: product.size_value, Icon: Ruler     },
                { label: "الحالة",  value: product.condition,  Icon: Sparkles  },
                { label: "الفئة",   value: product.category,   Icon: Layers    },
                { label: "الماركة", value: product.brand,       Icon: Tag       },
                ...(product.color ? [{ label: "اللون",   value: product.color, Icon: Palette }] : []),
                ...(product.city  ? [{ label: "المدينة", value: product.city,  Icon: MapPin  }] : []),
              ] as { label: string; value: string; Icon: React.ElementType }[]).map(({ label, value, Icon }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="flex-shrink-0 p-2.5 bg-[#581c3c]/5 text-[#581c3c] rounded-full">
                    <Icon size={18} strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-gray-400 font-medium mb-0.5">{label}</span>
                    <span className="text-sm font-bold text-gray-900">{value}</span>
                  </div>
                </div>
              ))}

              {/* Delivery — full width */}
              <div className="col-span-2 flex items-start gap-3">
                <div className="flex-shrink-0 p-2.5 bg-[#581c3c]/5 text-[#581c3c] rounded-full">
                  <Truck size={18} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-gray-400 font-medium mb-0.5">التوصيل</span>
                  <span className={`text-sm font-bold ${
                    product.delivery_available ? "text-emerald-700" : "text-gray-900"
                  }`}>
                    {product.delivery_available ? "يوجد توصيل خارج المدينة" : "داخل المدينة فقط"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Description */}
          {product.description && (
            <section className="py-5 border-b border-border">
              <h2 className="text-base font-bold text-foreground mb-3">الوصف</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </section>
          )}

          {/* Seller info */}
          <section className="py-5 border-b border-border md:border-b-0">
            <h2 className="text-base font-bold text-foreground mb-2">البائع</h2>
            <Link
              href={`/profile/${product.seller_id}`}
              className="flex items-center justify-between w-full p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold text-primary">{sellerInitial}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {seller?.full_name ?? "—"}
                </p>
              </div>
              <ChevronLeft className="h-4 w-4 text-gray-400 shrink-0" />
            </Link>
          </section>

          {/* Desktop CTA */}
          {whatsappHref && (
            <div className="hidden md:block pt-6">
              <WhatsAppCTA href={whatsappHref} />
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile CTA — fixed, hidden on desktop ───────────────────── */}
      {whatsappHref && (
        <div className="md:hidden fixed bottom-20 left-0 right-0 z-40 bg-card border-t border-border px-4 py-3">
          <WhatsAppCTA href={whatsappHref} />
        </div>
      )}
    </div>
  );
}
