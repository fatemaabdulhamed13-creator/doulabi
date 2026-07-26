#!/usr/bin/env node
/**
 * scripts/delete-supabase-bucket.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Empties and deletes the Supabase "product-images" storage bucket.
 *
 * Required .env.local variables (already present):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/delete-supabase-bucket.js
 *
 * The script will ask for confirmation before doing anything destructive.
 */

'use strict'

const fs       = require('fs')
const path     = require('path')
const readline = require('readline')

// ── Load .env.local ──────────────────────────────────────────────────────────
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

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET           = 'product-images'
const DELETE_BATCH     = 100   // Supabase max files per delete call
const LIST_PAGE_SIZE   = 100

// ── Validate ─────────────────────────────────────────────────────────────────
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recursively list every file path inside a prefix (handles folders). */
async function listAll(prefix = '') {
  const files = []
  let offset  = 0

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, {
        limit:  LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (error) throw new Error(`List error at "${prefix}": ${error.message}`)
    if (!data || data.length === 0) break

    for (const item of data) {
      const fullKey = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) {
        // folder — recurse
        const sub = await listAll(fullKey)
        files.push(...sub)
      } else {
        files.push(fullKey)
      }
    }

    if (data.length < LIST_PAGE_SIZE) break
    offset += LIST_PAGE_SIZE
  }

  return files
}

/** Split array into chunks of `size`. */
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Prompt user for y/n confirmation. */
function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║         Supabase Storage Bucket Deletion Script           ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  Target bucket : ${BUCKET}`)
  console.log(`  Project URL   : ${SUPABASE_URL}`)
  console.log('')

  // ── Step 1: Count files ───────────────────────────────────────────────────
  console.log('── Scanning bucket for files...')
  let allFiles
  try {
    allFiles = await listAll()
  } catch (err) {
    console.error('  ✗  Failed to list files:', err.message)
    process.exit(1)
  }

  console.log(`  Found ${allFiles.length} file(s) in "${BUCKET}".`)
  console.log('')

  // ── Step 2: Confirm ───────────────────────────────────────────────────────
  const ok = await confirm(
    `⚠️  This will permanently delete ALL ${allFiles.length} files and the "${BUCKET}" bucket.\n` +
    '   This action CANNOT be undone. Make sure your R2 migration is complete.\n\n' +
    '   Type "y" to confirm, anything else to cancel: '
  )

  if (!ok) {
    console.log('\n  Cancelled. Nothing was deleted.')
    process.exit(0)
  }

  console.log('')

  // ── Step 3: Delete files in batches ──────────────────────────────────────
  if (allFiles.length > 0) {
    console.log(`── Deleting ${allFiles.length} file(s) in batches of ${DELETE_BATCH}...`)
    const batches  = chunk(allFiles, DELETE_BATCH)
    let   deleted  = 0
    let   failed   = 0

    for (const batch of batches) {
      const { error } = await supabase.storage.from(BUCKET).remove(batch)
      if (error) {
        console.error(`  ✗  Batch delete error: ${error.message}`)
        failed += batch.length
      } else {
        deleted += batch.length
        process.stdout.write(`  ✓  ${deleted} / ${allFiles.length} deleted\r`)
      }
    }

    console.log(`\n  Done — ${deleted} deleted, ${failed} failed.`)

    if (failed > 0) {
      console.error('\n  ⚠️  Some files could not be deleted. The bucket may not be empty.')
      console.error('     Please delete remaining files manually in the Supabase dashboard,')
      console.error('     then re-run this script or delete the bucket via the dashboard.')
      process.exit(1)
    }
  } else {
    console.log('  Bucket is already empty — skipping file deletion.')
  }

  console.log('')

  // ── Step 4: Delete the bucket ─────────────────────────────────────────────
  console.log(`── Deleting bucket "${BUCKET}"...`)
  const { error: bucketError } = await supabase.storage.deleteBucket(BUCKET)

  if (bucketError) {
    console.error(`  ✗  Failed to delete bucket: ${bucketError.message}`)
    console.error('     If the bucket still has files, delete them in the Supabase dashboard first.')
    process.exit(1)
  }

  console.log(`  ✓  Bucket "${BUCKET}" deleted successfully.`)
  console.log('\n✅  All done. Your Supabase storage bucket has been removed.')
}

main().catch((err) => {
  console.error('\n💥  Unhandled error:', err)
  process.exit(1)
})
