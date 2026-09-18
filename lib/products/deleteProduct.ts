import { SupabaseClient } from "@supabase/supabase-js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "@/lib/r2";

export type DeleteProductResult = { error: string } | { ok: true };

/**
 * Deletes a product row (only if `userId` actually owns it) and best-effort
 * cleans up its images from R2. Shared by the web edit form's server
 * action and the API route the mobile app calls — mobile has no access to
 * Next.js server actions, so it needs an actual HTTP endpoint, but both
 * paths should behave identically (including the storage cleanup, which
 * mobile calling Supabase directly could never do on its own).
 */
export async function deleteProductForUser(
  supabase: SupabaseClient,
  productId: string,
  userId: string
): Promise<DeleteProductResult> {
  const { data: existing } = await supabase
    .from("products")
    .select("seller_id, image_urls")
    .eq("id", productId)
    .single();

  if (!existing || existing.seller_id !== userId) {
    return { error: "غير مصرح لك بحذف هذا الإعلان." };
  }

  // .select() after .delete() is required here — without it, Supabase/
  // PostgREST returns a "successful" response with no error even when RLS
  // silently matched zero rows (e.g. an expired/invalid session), which
  // would otherwise look identical to an actual delete and leave the row
  // untouched in the database while the app reports success.
  const { data: deletedRows, error: deleteError } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("seller_id", userId)
    .select("id");

  if (deleteError) {
    return { error: `تعذّر حذف الإعلان: ${deleteError.message}` };
  }
  if (!deletedRows || deletedRows.length === 0) {
    return { error: "تعذّر حذف الإعلان — تأكدي من تسجيل الدخول وحاولي مرة أخرى." };
  }

  // Best-effort image cleanup — the row (the part that actually matters to
  // the seller) is already gone regardless of whether this succeeds.
  const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
  if (publicBase) {
    await Promise.all(
      (existing.image_urls ?? []).map(async (url: string) => {
        if (!url.startsWith(`${publicBase}/`)) return;
        const key = url.slice(publicBase.length + 1);
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        } catch (err) {
          console.error("[deleteProductForUser] failed to delete R2 object:", key, err);
        }
      })
    );
  }

  return { ok: true };
}
