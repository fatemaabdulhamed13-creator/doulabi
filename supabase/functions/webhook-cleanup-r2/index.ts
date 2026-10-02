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

// The bucket was first served from its r2.dev address, then moved to img.shopdoulabi.com
// (R2_PUBLIC_URL). Listings saved before the switch still store r2.dev URLs, so both must resolve.
const LEGACY_R2_PUBLIC_URL = "https://pub-8f4065c3efc2429a8696ab412bf33229.r2.dev";

function keyFromPublicUrl(url: string): string | null {
  const bases = [Deno.env.get("R2_PUBLIC_URL"), LEGACY_R2_PUBLIC_URL]
    .filter((b): b is string => !!b)
    .map((b) => b.replace(/\/$/, ""));
  const base = bases.find((b) => url.startsWith(`${b}/`));
  if (!base) return null;
  const key = url.slice(base.length + 1);
  return key && !key.includes("..") ? key : null;
}

function thumbKeyFor(key: string): string | null {
  const match = key.match(/^([^/]+)\/photos\/([^/]+)$/);
  return match ? `${match[1]}/photos/thumbs/${match[2]}` : null;
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

  // Compared by R2 key, not URL: rewriting a listing's URLs from the r2.dev address to the
  // custom domain changes every URL but no file, and must not delete anything.
  const toKeys = (urls: string[] | null | undefined) =>
    (urls ?? []).map(keyFromPublicUrl).filter((k): k is string => k !== null);
  const oldKeys = toKeys(payload.old_record?.image_urls);
  let removedKeys: string[];
  if (payload.type === "DELETE") {
    removedKeys = oldKeys;
  } else if (payload.type === "UPDATE") {
    const kept = new Set(toKeys(payload.record?.image_urls));
    removedKeys = oldKeys.filter((key) => !kept.has(key));
  } else {
    return json({ skipped: payload.type });
  }

  const keys = removedKeys.flatMap((k) => {
    // Photos under photos/ have a card thumbnail at photos/thumbs/ with the same filename
    // (see presign-upload). R2 returns 204 for a missing key, so a failed thumb upload is fine.
    const thumbKey = thumbKeyFor(k);
    return thumbKey ? [k, thumbKey] : [k];
  });
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
