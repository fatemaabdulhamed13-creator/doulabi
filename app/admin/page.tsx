import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductCard, type PendingProduct } from "./ProductCard";

// Auth + is_admin gate lives in app/admin/layout.tsx — shared by every
// /admin/* route, so it isn't repeated here.
export default async function AdminPage() {
  const supabase = await createClient();

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
    .limit(50)
    .returns<PendingProduct[]>();

  const pending = products ?? [];

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-end mb-4">
        <span className="text-xs font-medium text-muted-foreground">
          {pending.length > 0
            ? `${pending.length} منتج بانتظار المراجعة`
            : 'لا توجد منتجات معلقة'}
        </span>
      </div>

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
  );
}
