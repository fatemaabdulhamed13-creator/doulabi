import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";

const PRESIGN_EXPIRES_SECONDS = 900;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await client.auth.getUser(authHeader.slice("Bearer ".length));
  return error || !data.user ? null : data.user.id;
}

async function presignPut(key: string): Promise<string> {
  const r2 = new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    service: "s3",
    region: "auto",
  });
  const account = Deno.env.get("R2_ACCOUNT_ID")!;
  const bucket = Deno.env.get("R2_BUCKET_NAME")!;
  const url = new URL(`https://${account}.r2.cloudflarestorage.com/${bucket}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(PRESIGN_EXPIRES_SECONDS));
  const signed = await r2.sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } });
  return signed.url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const userId = await getUserId(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const params = await readParams(req);
    const filename = params.filename ?? "image.jpg";
    const contentType = params.contentType ?? "image/jpeg";

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return json({ error: "Unsupported content type" }, 400);
    }

    const ext = (filename.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ALLOWED_EXTS.includes(ext) ? ext : "jpg";
    const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    // Not under raw/: the app uses this key as the listing's permanent photo, and raw/ expires after 24h.
    const key = `${userId}/${uid}.${safeExt}`;

    return json({ presignedUrl: await presignPut(key), key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[presign-upload] unexpected error:", msg);
    return json({ error: msg }, 500);
  }
});
