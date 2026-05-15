import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductCard, type PendingProduct } from "./ProductCard";

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
      <main className="max-w-5xl mx-auto p-8">

        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ClipboardList className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-semibold text-foreground">لا توجد منتجات بانتظار المراجعة</p>
            <p className="text-sm text-muted-foreground">كل شيء على ما يرام — عد لاحقاً.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
