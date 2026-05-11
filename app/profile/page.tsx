import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { type LucideIcon, ChevronLeft, Pencil, UserCircle, Settings, LogOut, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ListingPostedToast from "@/components/listing-posted-toast";
import { markAsSoldAction } from "@/app/actions/product";
import PageHeader from "@/components/PageHeader";

/* ── Types ───────────────────────────────────────────────────────────────── */

type Product = {
  id:         string;
  title:      string;
  price:      number;
  brand:      string;
  image_urls: string[];
  status:     "pending" | "approved" | "rejected";
  is_sold:    boolean;
};

/* ── Status badge config ─────────────────────────────────────────────────── */

const STATUS = {
  pending:  { label: "قيد المراجعة", className: "bg-amber-100  text-amber-700"   },
  approved: { label: "نشط",          className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "مرفوض",        className: "bg-red-100     text-red-700"     },
} as const;

/* ── Settings links ──────────────────────────────────────────────────────── */

type SettingsLink = { label: string; href: string; icon: LucideIcon; danger?: boolean };

const SETTINGS_LINKS: SettingsLink[] = [
  { label: "تعديل الملف الشخصي", href: "/profile/edit", icon: UserCircle },
  { label: "إعدادات التطبيق",     href: "/settings",     icon: Settings   },
  { label: "تسجيل الخروج",        href: "/logout",       icon: LogOut,    danger: true },
];

/* ── Page ────────────────────────────────────────────────────────────────── */

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, bio, created_at")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: productsData } = await supabase
    .from("products")
    .select("id, title, price, brand, image_urls, status, is_sold")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Product[]>();

  const products     = productsData ?? [];
  const totalSold    = products.filter((p) => p.is_sold).length;

  const initial  = profile.full_name.charAt(0);
  const joinYear = new Date(profile.created_at).getFullYear();

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-32">

      <Suspense fallback={null}>
        <ListingPostedToast />
      </Suspense>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <PageHeader
        title="الملف الشخصي"
        action={
          <Link
            href="/profile/edit"
            aria-label="تعديل الملف الشخصي"
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <Pencil className="h-5 w-5 text-foreground" />
          </Link>
        }
      />

      {/* ── Profile hero ─────────────────────────────────────────────── */}
      <section className="bg-card border-b border-border py-8">
        <div className="md:max-w-4xl mx-auto px-4 flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/20">
            <span className="text-4xl font-bold text-primary">{initial}</span>
          </div>

          <h2 className="text-xl font-bold text-foreground">{profile.full_name}</h2>

          {profile.bio && (
            <p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed">
              {profile.bio}
            </p>
          )}

          <p className="text-xs text-muted-foreground tracking-wide">انضمت في {joinYear}</p>
        </div>
      </section>

      {/* ── Stats row ────────────────────────────────────────────────── */}
      <section className="py-5 border-b border-border">
        <div className="md:max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl border border-border p-5 text-center">
              <p className="text-3xl font-black text-primary mb-1">{products.length}</p>
              <p className="text-xs font-semibold text-muted-foreground">معروضاتي</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5 text-center">
              <p className="text-3xl font-black text-primary mb-1">{totalSold}</p>
              <p className="text-xs font-semibold text-muted-foreground">تم بيعها</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Listings ─────────────────────────────────────────────────── */}
      <section className="px-4 py-7">
        <h2 className="text-2xl font-extrabold text-foreground mb-5">معروضاتي</h2>

        {products.length === 0 ? (
          /* ── Empty state ───────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center text-center py-16 px-4 md:max-w-md md:mx-auto">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <Tag className="h-9 w-9 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              لا توجد معروضات نشطة
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              ابدأ في بيع ملابسك الآن واكسب منها
            </p>
            <Link
              href="/sell"
              className="
                px-8 py-3.5 rounded-full
                bg-primary text-white font-bold text-sm
                hover:brightness-110 active:scale-[0.98]
                transition-all shadow-sm
              "
            >
              إضافة منتج
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {products.map((product) => {
              const img        = product.image_urls[0] ?? null;
              const badge      = STATUS[product.status];
              const soldAction = markAsSoldAction.bind(null, product.id);
              const canLink    = product.status === "approved" && !product.is_sold;

              return (
                <div key={product.id} className="flex flex-col gap-2.5">

                  {/* ── Image ──────────────────────────────────────── */}
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">

                    {/* Thumbnail */}
                    {img ? (
                      <Image
                        src={img}
                        alt={product.title}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className={`object-cover transition-transform duration-300 ${canLink ? "group-hover:scale-105" : ""}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Tag className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Sold overlay */}
                    {product.is_sold && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                        <span className="text-white font-black text-lg tracking-wide">مباع</span>
                      </div>
                    )}

                    {/* Status badge — top-right corner */}
                    <span className={`
                      absolute top-2 right-2
                      px-2 py-0.5 rounded-full
                      text-[10px] font-bold leading-none
                      ${badge.className}
                    `}>
                      {badge.label}
                    </span>
                  </div>

                  {/* ── Info ───────────────────────────────────────── */}
                  {canLink ? (
                    <Link href={`/product/${product.id}`}>
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{product.title}</p>
                      <p className="text-sm font-black text-foreground mt-0.5">
                        {product.price}{" "}
                        <span className="text-xs font-normal text-muted-foreground">د.ل</span>
                      </p>
                    </Link>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{product.title}</p>
                      <p className="text-sm font-black text-foreground mt-0.5">
                        {product.price}{" "}
                        <span className="text-xs font-normal text-muted-foreground">د.ل</span>
                      </p>
                    </div>
                  )}

                  {/* ── Mark-as-sold button ─────────────────────────── */}
                  {!product.is_sold && product.status === "approved" && (
                    <form action={soldAction}>
                      <button
                        type="submit"
                        className="
                          w-full py-2.5 rounded-xl
                          border border-primary text-primary
                          text-xs font-bold tracking-wide
                          hover:bg-primary/5 active:scale-[0.98]
                          transition-all
                        "
                      >
                        تحديد كمباع
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Settings ─────────────────────────────────────────────────── */}
      <section className="px-4 pb-6">
        <h2 className="text-2xl font-extrabold text-foreground mb-4">الإعدادات</h2>

        <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
          {SETTINGS_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.label}
                href={link.href}
                className="flex items-center justify-between px-4 py-4 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      link.danger ? "text-red-400" : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      link.danger ? "text-red-500" : "text-foreground"
                    }`}
                  >
                    {link.label}
                  </span>
                </div>
                <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
