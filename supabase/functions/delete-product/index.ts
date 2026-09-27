import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Accepts params from the query string (plain fetch) or a JSON body (supabase.functions.invoke).
async function readParams(req: Request): Promise<Record<string, string>> {
  const params: Record<string, string> = Object.fromEntries(new URL(req.url).searchParams);
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await req.json();
      for (const [k, v] of Object.entries(body ?? {})) if (typeof v === "string") params[k] = v;
    } catch {
      // empty or malformed body — fall back to query params
    }
  }
  return params;
}

async function deleteFromR2(imageUrl: string): Promise<void> {
  const publicBase = Deno.env.get("R2_PUBLIC_URL")?.replace(/\/$/, "");
  if (!publicBase || !imageUrl.startsWith(`${publicBase}/`)) return;
  const key = imageUrl.slice(publicBase.length + 1);

  const r2 = new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    service: "s3",
    region: "auto",
  });
  const account = Deno.env.get("R2_ACCOUNT_ID")!;
  const bucket = Deno.env.get("R2_BUCKET_NAME")!;
  const res = await r2.fetch(`https://${account}.r2.cloudflarestorage.com/${bucket}/${key}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed (${res.status}) for ${key}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    // Queries run as the caller, so row-level security still applies.
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await client.auth.getUser(authHeader.slice("Bearer ".length));
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { id: productId } = await readParams(req);
    if (!productId) return json({ error: "id is required" }, 400);

    const { data: existing } = await client
      .from("products")
      .select("seller_id, image_urls")
      .eq("id", productId)
      .single();

    if (!existing || existing.seller_id !== userId) {
      return json({ error: "غير مصرح لك بحذف هذا الإعلان." }, 403);
    }

    // .select() is required: without it RLS silently matching zero rows looks like success.
    const { data: deletedRows, error: deleteError } = await client
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("seller_id", userId)
      .select("id");

    if (deleteError) {
      return json({ error: `تعذّر حذف الإعلان: ${deleteError.message}` }, 403);
    }
    if (!deletedRows || deletedRows.length === 0) {
      return json({ error: "تعذّر حذف الإعلان — تأكدي من تسجيل الدخول وحاولي مرة أخرى." }, 403);
    }

    await Promise.all(
      ((existing.image_urls ?? []) as string[]).map((url) =>
        deleteFromR2(url).catch((err) => console.error("[delete-product] image cleanup failed:", err))
      ),
    );

    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[delete-product] unexpected error:", msg);
    return json({ error: msg }, 500);
  }
});
