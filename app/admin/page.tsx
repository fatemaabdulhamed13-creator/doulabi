import { ClipboardList } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/actions/product";
import { ProductCard, type PendingProduct } from "./ProductCard";

// Sellers' WhatsApp numbers aren't readable through normal logged-in
// access (20261001b_lock_whatsapp_column.sql), so this page reads with the
// service-role client. That bypasses RLS, so the admin check is repeated
// here rather than relying on app/admin/layout.tsx alone — Next renders a
// layout and its page in parallel, so a layout redirect doesn't stop the
// page's own data fetch from running.
export default async function AdminPage() {
  await requireAdmin();
  const supabase = createAdminClient();

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
