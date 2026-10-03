import { ClipboardList } from "lucide-react";
import { requireAdmin } from "@/app/actions/product";
import { ProductCard, type PendingProduct } from "./ProductCard";

// Reads with the admin's own session — RLS already lets admins see every
// listing. Sellers' numbers aren't readable that way (the column is locked
// for all logged-in users), so they come from admin_seller_whatsapp(),
// which only answers admins. No service-role key involved, so this page
// doesn't depend on that key being set in the hosting environment.
export default async function AdminPage() {
  const supabase = await requireAdmin();

  // ── Fetch pending products with seller info ─────────────────────────────
  const { data: rows, error } = await supabase
    .from('products')
    .select(`
      id, seller_id, title, price, category, brand,
      size_type, size_value, condition,
      description, image_urls, created_at,
      profiles ( full_name )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) console.error('[admin] failed to load pending listings:', error.message)

  const sellerIds = [...new Set((rows ?? []).map((r) => r.seller_id as string))]
  const { data: numbers } = sellerIds.length
    ? await supabase.rpc('admin_seller_whatsapp', { p_seller_ids: sellerIds })
    : { data: [] as { id: string; whatsapp_number: string }[] }
  const numberBySeller = new Map(
    ((numbers ?? []) as { id: string; whatsapp_number: string }[]).map((n) => [n.id, n.whatsapp_number]),
  )

  const pending: PendingProduct[] = (rows ?? []).map((r) => {
    // supabase-js types the many-to-one join as an array without generated types.
    const seller = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { full_name: string } | null
    return {
      ...r,
      profiles: seller
        ? { full_name: seller.full_name, whatsapp_number: numberBySeller.get(r.seller_id as string) ?? '' }
        : null,
    } as PendingProduct
  })

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
