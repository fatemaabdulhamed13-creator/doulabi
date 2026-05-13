/**
 * lib/imageCompression.ts
 *
 * Client-side image compression utility for Doulabi marketplace.
 *
 * Workflow: select → [HEIC/HEIF → JPEG] → resize (max 1200px) → encode to WebP → strip metadata → upload
 *
 * Key decisions:
 *  - normalizeFile() — detects HEIC/HEIF by MIME type AND extension (iOS reports
 *    an empty MIME type on some browsers), converts to JPEG via heic2any before
 *    handing the file to browser-image-compression which cannot decode HEIC natively.
 *    heic2any is dynamically imported so its ~1.3 MB WASM payload is only fetched
 *    when a HEIC file is actually selected — zero cost for JPEG/PNG/WebP uploads.
 *  - maxWidthOrHeight: 1200 — phones shoot at 12–50 MP; 1200px covers e-commerce quality
 *  - initialQuality: 0.80 — sweet-spot for clothing photos: sharp enough, typically 150–350 KB
 *  - maxSizeMB: 0.35 — 350 KB hard ceiling; library degrades quality only if needed
 *  - useWebWorker: true — CRITICAL: keeps the UI thread free during heavy encoding
 *  - fileType: 'image/webp' — forces WebP conversion and strips all EXIF/GPS metadata
 *    because canvas.toBlob() does not copy the original metadata bytes
 */

import imageCompression, { Options } from 'browser-image-compression'

// ── Options ───────────────────────────────────────────────────────────────────

/** Options for full-resolution marketplace listing images (target 150–350 KB). */
const LISTING_OPTIONS: Options = {
  maxSizeMB: 0.35,
  maxWidthOrHeight: 1200,
  initialQuality: 0.80,
  useWebWorker: true,
  fileType: 'image/webp',
  alwaysKeepResolution: false,
}

/** Options for thumbnail / preview images (target ≤ 60 KB). */
const THUMBNAIL_OPTIONS: Options = {
  maxSizeMB: 0.06,
  maxWidthOrHeight: 400,
  initialQuality: 0.80,
  useWebWorker: true,
  fileType: 'image/webp',
  alwaysKeepResolution: false,
}

// ── HEIC/HEIF normalisation ───────────────────────────────────────────────────

/**
 * Returns true if the file needs HEIC→JPEG conversion before compression.
 *
 * iOS Safari frequently auto-converts HEIC to JPEG internally, but the File
 * object keeps the original .HEIC filename. Checking the extension alone would
 * pass a JPEG into heic2any, which crashes trying to parse it as HEIC.
 *
 * Rule: trust the MIME type when it is a known image type. Only fall back to
 * the extension when the MIME type is absent ("") or a generic binary type —
 * which is what some iOS/Android browsers report for unconverted HEIC files.
 */
function isHeicFile(file: File): boolean {
  const mime = file.type.toLowerCase()

  // MIME type is present and specific — trust it completely
  if (mime && mime !== 'application/octet-stream') {
    return (
      mime === 'image/heic'          ||
      mime === 'image/heif'          ||
      mime === 'image/heic-sequence' ||
      mime === 'image/heif-sequence'
    )
  }

  // MIME type absent or generic — fall back to extension
  const ext = file.name.toLowerCase()
  return ext.endsWith('.heic') || ext.endsWith('.heif')
}

/**
 * If the file is HEIC/HEIF, converts it to a JPEG File using heic2any.
 * heic2any is dynamically imported so the WASM bundle is only loaded when needed.
 * All other formats are returned unchanged.
 */
async function normalizeFile(file: File): Promise<File> {
  if (!isHeicFile(file)) return file

  try {
    // Dynamic import — WASM only fetched when a HEIC file is actually selected
    const { default: heic2any } = await import('heic2any')

    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    })

    // heic2any returns Blob | Blob[] (burst photos yield multiple frames; use the first)
    const blob = Array.isArray(result) ? result[0] : result

    const base = file.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`HEIC Conversion Failed: ${detail}`)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compresses a single image file to marketplace-quality WebP.
 * HEIC/HEIF files are transparently converted to JPEG first.
 * In development, logs before/after file sizes to the console.
 */
export async function compressListingImage(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<File> {
  const normalized = await normalizeFile(file)

  const options: Options = {
    ...LISTING_OPTIONS,
    ...(onProgress ? { onProgress } : {}),
  }

  const compressed = await imageCompression(normalized, options)
  const result = toNamedWebpFile(compressed, file.name)

  if (process.env.NODE_ENV === 'development') {
    const beforeKB = (file.size / 1024).toFixed(1)
    const afterKB  = (result.size / 1024).toFixed(1)
    const saving   = (((file.size - result.size) / file.size) * 100).toFixed(0)
    console.log(
      `[imageCompression] ${file.name}\n` +
      `  before : ${beforeKB} KB${isHeicFile(file) ? ' (HEIC→JPEG first)' : ''}\n` +
      `  after  : ${afterKB} KB  (−${saving}%)`,
    )
  }

  return result
}

/**
 * Compresses a single image to a small thumbnail WebP.
 * HEIC/HEIF files are transparently converted to JPEG first.
 */
export async function compressThumbnailImage(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<File> {
  const normalized = await normalizeFile(file)

  const options: Options = {
    ...THUMBNAIL_OPTIONS,
    ...(onProgress ? { onProgress } : {}),
  }

  const compressed = await imageCompression(normalized, options)
  return toNamedWebpFile(compressed, file.name)
}

/**
 * Batch-compresses an array of files for listing upload.
 * Runs all compressions in parallel (each in its own Web Worker).
 * HEIC/HEIF files in the batch are handled automatically.
 */
export async function compressListingImages(
  files: File[],
  onProgress?: (fileIndex: number, progress: number) => void,
): Promise<File[]> {
  return Promise.all(
    files.map((file, idx) =>
      compressListingImage(
        file,
        onProgress ? (p) => onProgress(idx, p) : undefined,
      ),
    ),
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wraps a Blob/File in a new File with a clean, unique .webp filename.
 * Always uses the original file name as the base so the output name is stable.
 */
function toNamedWebpFile(blob: Blob, originalName: string): File {
  const base = originalName
    .replace(/\.[^.]+$/, '')           // strip original extension (incl. .heic)
    .replace(/[^a-zA-Z0-9_-]/g, '_')  // sanitise to URL-safe chars
    .slice(0, 60)
    || 'image'

  const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return new File([blob], `${base}_${uid}.webp`, { type: 'image/webp' })
}
