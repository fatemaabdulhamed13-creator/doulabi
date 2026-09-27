import { AwsClient } from "npm:aws4fetch@1";

// Called by a Supabase Database Webhook on the `products` table.
// DELETE: removes every image of the deleted row. UPDATE: removes only images dropped from image_urls.

type ProductRow = { id?: string; image_urls?: string[] | null } | null;
type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: ProductRow;
  old_record: ProductRow;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function keyFromPublicUrl(url: string): string | null {
  const base = Deno.env.get("R2_PUBLIC_URL")?.replace(/\/$/, "");
  if (!base || !url.startsWith(`${base}/`)) return null;
  const key = url.slice(base.length + 1);
  return key && !key.includes("..") ? key : null;
}

Deno.serve(async (req) => {
  // The webhook is configured to send this header; anything without it is rejected.
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (payload.table !== "products") return json({ skipped: "not the products table" });

  const oldUrls = payload.old_record?.image_urls ?? [];
  let removedUrls: string[];
  if (payload.type === "DELETE") {
    removedUrls = oldUrls;
  } else if (payload.type === "UPDATE") {
    const kept = new Set(payload.record?.image_urls ?? []);
    removedUrls = oldUrls.filter((url) => !kept.has(url));
  } else {
    return json({ skipped: payload.type });
  }

  const keys = removedUrls.map(keyFromPublicUrl).filter((k): k is string => k !== null);
  if (keys.length === 0) return json({ deleted: 0 });

  const r2 = new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    service: "s3",
    region: "auto",
  });
  const account = Deno.env.get("R2_ACCOUNT_ID")!;
  const bucket = Deno.env.get("R2_BUCKET_NAME")!;

  const results = await Promise.all(
    keys.map(async (key) => {
      const path = key.split("/").map(encodeURIComponent).join("/");
      const res = await r2.fetch(`https://${account}.r2.cloudflarestorage.com/${bucket}/${path}`, { method: "DELETE" });
      // R2 returns 204 even if the file is already gone (e.g. the app's delete already removed it).
      if (!res.ok) console.error(`[webhook-cleanup-r2] failed to delete ${key}: ${res.status} ${await res.text()}`);
      return res.ok;
    }),
  );

  const failed = results.filter((ok) => !ok).length;
  console.log(`[webhook-cleanup-r2] ${payload.type} product ${payload.old_record?.id}: deleted ${keys.length - failed}, failed ${failed}`);
  return json({ deleted: keys.length - failed, failed }, failed ? 500 : 200);
});
