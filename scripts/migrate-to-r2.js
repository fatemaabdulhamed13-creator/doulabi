#!/usr/bin/env node
/**
 * scripts/migrate-to-r2.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time migration script: copies every file from the Supabase
 * "product-images" bucket into a Cloudflare R2 bucket, then (with --update-db)
 * rewrites existing products.image_urls rows so URLs point to R2.
 *
 * Prerequisites
 * ─────────────
 * Run `npm install` first so @aws-sdk/client-s3 and @supabase/supabase-js are
 * available.
 *
 * Required .env.local variables
 * ─────────────────────────────
 *   NEXT_PUBLIC_SUPABASE_URL      (already present)
 *   SUPABASE_SERVICE_ROLE_KEY     (already present)
 *   R2_ACCOUNT_ID                 Your Cloudflare account ID
 *   R2_ACCESS_KEY_ID              R2 API token access key
 *   R2_SECRET_ACCESS_KEY          R2 API token secret key
 *   R2_BUCKET_NAME                Name of the R2 bucket (e.g. "product-images")
 *   NEXT_PUBLIC_R2_PUBLIC_URL     Public base URL  (e.g. https://pub-xxxx.r2.dev)
 *
 * Usage
 * ─────
 *   # Copy files only:
 *   node scripts/migrate-to-r2.js
 *
 *   # Copy files AND rewrite DB rows:
 *   node scripts/migrate-to-r2.js --update-db
 */

'use strict'

const fs   = require('fs')
const path = require('path')

// ── Load .env.local manually (no dotenv dependency needed) ─────────────────
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = val
  }
}

const { createClient }   = require('@supabase/supabase-js')
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3')

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY
const R2_ACCOUNT_ID       = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID    = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY= process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET           = process.env.R2_BUCKET_NAME
const R2_PUBLIC_URL       = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').replace(/\/$/, '')

const SUPABASE_BUCKET     = 'product-images'
const PAGE_SIZE           = 100          // Supabase storage list page size
const CONCURRENCY         = 5           // parallel transfers at a time
const UPDATE_DB           = process.argv.includes('--update-db')

// ── Validation ──────────────────────────────────────────────────────────────
const missing = [
  ['NEXT_PUBLIC_SUPABASE_URL',   SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY',  SERVICE_ROLE_KEY],
  ['R2_ACCOUNT_ID',              R2_ACCOUNT_ID],
  ['R2_ACCESS_KEY_ID',           R2_ACCESS_KEY_ID],
  ['R2_SECRET_ACCESS_KEY',       R2_SECRET_ACCESS_KEY],
  ['R2_BUCKET_NAME',             R2_BUCKET],
  ['NEXT_PUBLIC_R2_PUBLIC_URL',  R2_PUBLIC_URL],
].filter(([, v]) => !v).map(([k]) => k)

if (missing.length) {
  console.error('❌  Missing required environment variables:\n  ' + missing.join('\n  '))
  process.exit(1)
}

// ── Clients ─────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Guess a MIME type from the file extension. */
function guessMime(key) {
  if (key.endsWith('.webp')) return 'image/webp'
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg'
  if (key.endsWith('.png'))  return 'image/png'
  if (key.endsWith('.gif'))  return 'image/gif'
  return 'application/octet-stream'
}

/** Returns true if the key already exists in R2. */
async function existsInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return true
  } catch (e) {
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return false
    throw e
  }
}

/** Run an array of async tasks with a concurrency cap. */
async function pLimit(tasks, limit) {
  const results = []
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const idx = i++
      results[idx] = await tasks[idx]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

/** Fetch all file paths from a Supabase storage bucket (handles pagination). */
async function listAllFiles(prefix = '') {
  const files = []
  let offset  = 0

  while (true) {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } })

    if (error) throw new Error(`Supabase list error: ${error.message}`)
    if (!data || data.length === 0) break

    for (const item of data) {
      const fullKey = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) {
        // It's a folder — recurse
        const sub = await listAllFiles(fullKey)
        files.push(...sub)
      } else {
        files.push(fullKey)
      }
    }

    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return files
}

/** Download from Supabase and upload to R2. Returns 'copied' | 'skipped' | 'error'. */
async function migrateFile(key) {
  // Skip if already in R2
  if (await existsInR2(key)) {
    console.log(`  ⏭  skipped (already exists): ${key}`)
    return 'skipped'
  }

  // Download
  const { data: blob, error: dlError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .download(key)

  if (dlError || !blob) {
    console.error(`  ✗  download failed: ${key} — ${dlError?.message ?? 'no blob'}`)
    return 'error'
  }

  const buffer = Buffer.from(await blob.arrayBuffer())

  // Upload to R2
  try {
    await r2.send(new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: guessMime(key),
    }))
    console.log(`  ✓  ${key}`)
    return 'copied'
  } catch (err) {
    console.error(`  ✗  upload failed: ${key} — ${err.message}`)
    return 'error'
  }
}

// ── DB URL rewrite ──────────────────────────────────────────────────────────

/**
 * Derive the old Supabase public base URL for the storage bucket.
 * e.g. https://sdjxuzmmjeypqdoookab.supabase.co/storage/v1/object/public/product-images
 */
function supabasePublicBase() {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}`
}

async function rewriteDbUrls() {
  console.log('\n── Rewriting products.image_urls in database ──────────────────')
  const oldBase = supabasePublicBase()

  // Fetch all products that have at least one Supabase image URL
  const { data: products, error } = await supabase
    .from('products')
    .select('id, image_urls')
    .not('image_urls', 'is', null)

  if (error) {
    console.error('  ✗  Failed to fetch products:', error.message)
    return
  }

  const toUpdate = (products || []).filter((p) =>
    Array.isArray(p.image_urls) && p.image_urls.some((u) => u.startsWith(oldBase))
  )

  console.log(`  Found ${toUpdate.length} product(s) with Supabase image URLs to rewrite.`)

  let updated = 0
  let failed  = 0

  for (const product of toUpdate) {
    const newUrls = product.image_urls.map((u) => {
      if (!u.startsWith(oldBase)) return u          // already R2 or other — leave alone
      const key = u.slice(oldBase.length).replace(/^\//, '')
      return `${R2_PUBLIC_URL}/${key}`
    })

    const { error: updErr } = await supabase
      .from('products')
      .update({ image_urls: newUrls })
      .eq('id', product.id)

    if (updErr) {
      console.error(`  ✗  Failed to update product ${product.id}: ${updErr.message}`)
      failed++
    } else {
      console.log(`  ✓  Updated product ${product.id}`)
      updated++
    }
  }

  console.log(`\n  DB rewrite done — ${updated} updated, ${failed} failed.`)
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║         Supabase → Cloudflare R2 Image Migration          ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  Supabase bucket : ${SUPABASE_BUCKET}`)
  console.log(`  R2 bucket       : ${R2_BUCKET}`)
  console.log(`  R2 public URL   : ${R2_PUBLIC_URL}`)
  console.log(`  Update DB       : ${UPDATE_DB ? 'YES' : 'NO (pass --update-db to enable)'}`)
  console.log('')

  console.log('── Listing files in Supabase ───────────────────────────────')
  let allFiles
  try {
    allFiles = await listAllFiles()
  } catch (err) {
    console.error('Failed to list files:', err.message)
    process.exit(1)
  }
  console.log(`  Found ${allFiles.length} file(s).`)

  if (allFiles.length === 0) {
    console.log('  Nothing to migrate.')
  } else {
    console.log('\n── Migrating files ─────────────────────────────────────────')
    const tasks = allFiles.map((key) => () => migrateFile(key))
    const results = await pLimit(tasks, CONCURRENCY)

    const counts = { copied: 0, skipped: 0, error: 0 }
    for (const r of results) counts[r]++

    console.log(`\n  Summary: ${counts.copied} copied, ${counts.skipped} skipped, ${counts.error} errors.`)
    if (counts.error > 0) {
      console.warn('  ⚠  Some files failed to migrate. Review the errors above.')
    }
  }

  if (UPDATE_DB) {
    await rewriteDbUrls()
  } else {
    console.log('\n  ℹ  Run with --update-db to rewrite products.image_urls in the database.')
  }

  console.log('\n✅  Migration complete.')
}

main().catch((err) => {
  console.error('\n💥  Unhandled error:', err)
  process.exit(1)
})
