#!/usr/bin/env node
/**
 * scripts/backfill-thumbnails.mjs
 *
 * Gives listings uploaded before thumbnails existed the same layout new app uploads use:
 * each photo is copied to <seller>/photos/<file> with a card-sized copy at
 * <seller>/photos/thumbs/<file>, and the listing's image_urls is rewritten to the new copies,
 * in the same order. Cards (app and web) only look for a thumbnail under /photos/, so this is
 * what switches old listings over.
 *
 * The old files are not deleted here: once image_urls no longer references them, the
 * webhook-cleanup-r2 function removes them (it compares by R2 key, so the domain doesn't matter).
 * Anything it misses is picked up by cleanup-orphaned-r2.mjs.
 *
 * Safety rules:
 *   - Dry run unless --apply is passed: lists what would change, touches nothing.
 *   - Only photos in our own bucket (either public address) are processed; other URLs are kept as-is.
 *   - Photos already under photos/ are skipped, so re-running is safe (keys are deterministic,
 *     so a run that stopped halfway just overwrites the same copies).
 *   - If a photo can't be read or converted, that photo keeps its original URL.
 *
 * Usage (from the project root, needs the R2 + Supabase values in .env.local):
 *   node --env-file=.env.local scripts/backfill-thumbnails.mjs          # dry run
 *   node --env-file=.env.local scripts/backfill-thumbnails.mjs --apply  # actually do it
 *
 * sharp comes with Next.js (it's how next/image resizes), so there's nothing extra to install.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const APPLY = process.argv.includes("--apply");

// Must match the app's thumbnails (dowlaby-mobile sell.tsx): 600px on the longest side.
const THUMB_MAX_DIMENSION = 600;
const THUMB_QUALITY = 70;

// Listings saved before the move to the custom domain may still store r2.dev URLs.
const LEGACY_R2_PUBLIC_URL = "https://pub-8f4065c3efc2429a8696ab412bf33229.r2.dev";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_R2_PUBLIC_URL",
  "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/$/, "");
const knownBases = [publicBase, LEGACY_R2_PUBLIC_URL];
const bucket = process.env.R2_BUCKET_NAME;
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function keyFromUrl(url) {
  if (typeof url !== "string") return null;
  const base = knownBases.find((b) => url.startsWith(`${b}/`));
  if (!base) return null;
  const path = url.slice(base.length + 1).split("?")[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

const isAlreadyMigrated = (key) => /^[^/]+\/photos\/[^/]+$/.test(key);

async function fetchAllProducts() {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("id, seller_id, title, image_urls")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Reading products failed: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

async function readObject(key) {
  const res = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return { body: Buffer.from(await res.Body.transformToByteArray()), contentType: res.ContentType };
}

// The thumbnail shares the photo's filename (that's how cards find it), so it keeps the
// extension; JPEGs stay JPEG, everything else (webp/png/heic) becomes WebP, which every
// browser and the app can show. The served Content-Type is what decides how it renders.
async function makeThumbnail(body, ext) {
  const pipeline = sharp(body)
    .rotate() // respect EXIF orientation, like the phone did for the original
    .resize({ width: THUMB_MAX_DIMENSION, height: THUMB_MAX_DIMENSION, fit: "inside", withoutEnlargement: true });
  return ext === "jpg" || ext === "jpeg"
    ? { body: await pipeline.jpeg({ quality: THUMB_QUALITY }).toBuffer(), contentType: "image/jpeg" }
    : { body: await pipeline.webp({ quality: THUMB_QUALITY }).toBuffer(), contentType: "image/webp" };
}

async function migratePhoto(product, url) {
  const key = keyFromUrl(url);
  if (!key || isAlreadyMigrated(key)) return { url, status: "skipped" };

  const filename = key.split("/").pop();
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const newKey = `${product.seller_id}/photos/${filename}`;
  const thumbKey = `${product.seller_id}/photos/thumbs/${filename}`;
  const newUrl = `${publicBase}/${newKey}`;

  if (!APPLY) return { url: newUrl, status: "would-migrate", from: key };

  try {
    const original = await readObject(key);
    const thumb = await makeThumbnail(original.body, ext);
    await r2.send(new PutObjectCommand({
      Bucket: bucket, Key: newKey, Body: original.body, ContentType: original.contentType,
    }));
    await r2.send(new PutObjectCommand({
      Bucket: bucket, Key: thumbKey, Body: thumb.body, ContentType: thumb.contentType,
    }));
    return { url: newUrl, status: "migrated", from: key, bytes: original.body.length, thumbBytes: thumb.body.length };
  } catch (err) {
    console.error(`  ! ${key}: ${err.message} — keeping the original URL`);
    return { url, status: "failed", from: key };
  }
}

function kb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

const products = await fetchAllProducts();
console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${products.length} listings read\n`);

const totals = { listings: 0, migrated: 0, failed: 0, skipped: 0, wouldMigrate: 0, bytes: 0, thumbBytes: 0 };

for (const product of products) {
  const urls = product.image_urls ?? [];
  if (urls.length === 0) continue;

  // One listing at a time, its photos in parallel — keeps order and memory predictable.
  const results = await Promise.all(urls.map((url) => migratePhoto(product, url)));
  const changed = results.some((r) => r.status === "migrated" || r.status === "would-migrate");

  for (const r of results) {
    if (r.status === "migrated") { totals.migrated++; totals.bytes += r.bytes; totals.thumbBytes += r.thumbBytes; }
    else if (r.status === "would-migrate") totals.wouldMigrate++;
    else if (r.status === "failed") totals.failed++;
    else totals.skipped++;
  }
  if (!changed) continue;
  totals.listings++;

  const label = `${product.id} "${product.title}"`;
  if (!APPLY) {
    console.log(`would update ${label}: ${results.filter((r) => r.status === "would-migrate").length}/${urls.length} photos`);
    continue;
  }

  const { error } = await supabase
    .from("products")
    .update({ image_urls: results.map((r) => r.url) })
    .eq("id", product.id);
  if (error) {
    // The copies exist but the listing still points at the originals — nothing is lost;
    // re-running overwrites the same copies and retries this update.
    console.error(`  ! failed to update ${label}: ${error.message}`);
    continue;
  }
  const done = results.filter((r) => r.status === "migrated").length;
  console.log(`updated ${label}: ${done}/${urls.length} photos`);
}

console.log("");
console.log(`Listings ${APPLY ? "updated" : "to update"}: ${totals.listings}`);
if (APPLY) {
  console.log(`Photos migrated:  ${totals.migrated}  (full ${kb(totals.bytes)} → thumbnails ${kb(totals.thumbBytes)})`);
  console.log(`Photos failed:    ${totals.failed}  (kept their original URL — safe to re-run)`);
} else {
  console.log(`Photos to migrate: ${totals.wouldMigrate}`);
  console.log("\nDry run — nothing was changed. Re-run with --apply to do it.");
}
console.log(`Photos skipped:   ${totals.skipped}  (already migrated, or not in our bucket)`);
