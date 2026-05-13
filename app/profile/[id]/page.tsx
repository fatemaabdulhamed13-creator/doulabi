import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
};

type Listing = {
  id:         string;
  title:      string;
  price:      number;
  brand:      string;
  size_value: string;
  image_urls: string[];
};

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  const { data } = await supabase
    .from("products")
    .select("id, title, price, brand, size_value, image_urls")
    .eq("seller_id", id)
    .eq("status", "approved")
    .eq("is_sold", false)
    .order("created_at", { ascending: false })
    .returns<Listing[]>();

  const listings = data ?? [];
  const initial  = profile.full_name.charAt(0);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <div className="w-full border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-primary">{initial}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{profile.full_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {listings.length} {listings.length === 1 ? "إعلان نشط" : "إعلانات نشطة"}
            </p>
          </div>
        </div>
      </div>

      {/* Listings */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-base font-semibold text-gray-900">لا توجد إعلانات نشطة</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {listings.map((p) => {
              const img = p.image_urls[0] ?? null;
              return (
                <Link key={p.id} href={`/product/${p.id}`} className="group flex flex-col gap-2">
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted">
                    {img ? (
                      <Image
                        src={img}
                        alt={`${p.brand} — ${p.title}`}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 50vw, 25vw"
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
                      {p.brand}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{p.title}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-sm font-black text-gray-900">
                        {p.price}{" "}
                        <span className="text-xs font-normal text-gray-400">د.ل</span>
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
      </div>
    </div>
  );
}
