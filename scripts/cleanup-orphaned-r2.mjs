#!/usr/bin/env node
/**
 * scripts/cleanup-orphaned-r2.mjs
 *
 * Finds files in the R2 bucket that no listing (products.image_urls) or profile
 * (profiles.avatar_url) points to anymore, and optionally deletes them.
 *
 * Safety rules:
 *   - Report only unless --delete is passed.
 *   - Only files under <user-id>/... or raw/<user-id>/... are considered; anything else is left alone.
 *   - Files newer than 48 hours are skipped (a listing may still be in the middle of being posted).
 *   - Refuses to delete if no listings were found (guards against a failed/empty database read).
 *
 * Usage (from the project root, needs the R2 + Supabase values in .env.local):
 *   node --env-file=.env.local scripts/cleanup-orphaned-r2.mjs           # report only
 *   node --env-file=.env.local scripts/cleanup-orphaned-r2.mjs --delete  # actually delete
 *
 * The full list of orphaned files is written to r2-orphans.txt for review.
 */

import { writeFileSync } from "node:fs";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const DELETE = process.argv.includes("--delete");
const MIN_AGE_MS = 48 * 60 * 60 * 1000;
// <user>/<file>, raw/<user>/<file>, and newer uploads' <user>/photos/<file> + <user>/photos/thumbs/<file>.
const USER_FILE_KEY = /^(raw\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(photos\/(thumbs\/)?)?[^/]+$/i;
// Listings saved before the move to the custom domain still store r2.dev URLs. Without this, every
// one of their photos would look unreferenced — and be deleted with --delete.
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

const publicBases = [process.env.NEXT_PUBLIC_R2_PUBLIC_URL, LEGACY_R2_PUBLIC_URL].map((b) => b.replace(/\/$/, ""));
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
  const publicBase = publicBases.find((b) => url.startsWith(`${b}/`));
  if (!publicBase) return null;
  const path = url.slice(publicBase.length + 1).split("?")[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

async function fetchAll(table, columns) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

async function listBucket() {
  const objects = [];
  let token;
  do {
    const page = await r2.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    objects.push(...(page.Contents ?? []));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const products = await fetchAll("products", "image_urls");
const profiles = await fetchAll("profiles", "avatar_url");

const inUse = new Set();
for (const p of products) for (const url of p.image_urls ?? []) {
  const key = keyFromUrl(url);
  if (!key) continue;
  inUse.add(key);
  // A photo's thumbnail isn't stored in the DB — it's in use whenever the photo is.
  const photo = key.match(/^([^/]+)\/photos\/([^/]+)$/);
  if (photo) inUse.add(`${photo[1]}/photos/thumbs/${photo[2]}`);
}
for (const p of profiles) {
  const key = keyFromUrl(p.avatar_url);
  if (key) inUse.add(key);
}

const objects = await listBucket();
const now = Date.now();
const orphans = [];
let skippedOther = 0;
let skippedRecent = 0;
let totalBytes = 0;

for (const obj of objects) {
  totalBytes += obj.Size ?? 0;
  if (inUse.has(obj.Key)) continue;
  if (!USER_FILE_KEY.test(obj.Key)) { skippedOther++; continue; }
  if (now - new Date(obj.LastModified).getTime() < MIN_AGE_MS) { skippedRecent++; continue; }
  orphans.push(obj);
}

const orphanBytes = orphans.reduce((sum, o) => sum + (o.Size ?? 0), 0);
writeFileSync(
  "r2-orphans.txt",
  orphans.map((o) => `${o.Key}\t${mb(o.Size ?? 0)}\t${new Date(o.LastModified).toISOString()}`).join("\n") + "\n",
);

console.log(`Listings read:              ${products.length}`);
console.log(`Files referenced by the DB: ${inUse.size}`);
console.log(`Files in bucket:            ${objects.length} (${mb(totalBytes)})`);
console.log(`Orphaned files:             ${orphans.length} (${mb(orphanBytes)})  → listed in r2-orphans.txt`);
console.log(`Skipped, newer than 48h:    ${skippedRecent}`);
console.log(`Skipped, not a user photo:  ${skippedOther}`);

if (!DELETE) {
  console.log("\nReport only — nothing was deleted. Re-run with --delete to remove the orphaned files.");
  process.exit(0);
}

if (products.length === 0) {
  console.error("\nRefusing to delete: no listings were found, which looks like a failed database read.");
  process.exit(1);
}

let deleted = 0;
for (let i = 0; i < orphans.length; i += 1000) {
  const batch = orphans.slice(i, i + 1000);
  const res = await r2.send(new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: batch.map((o) => ({ Key: o.Key })), Quiet: true },
  }));
  for (const err of res.Errors ?? []) console.error(`Failed to delete ${err.Key}: ${err.Message}`);
  deleted += batch.length - (res.Errors?.length ?? 0);
}
console.log(`\nDeleted ${deleted} files (${mb(orphanBytes)} freed).`);
