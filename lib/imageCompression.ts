/**
 * lib/imageCompression.ts
 *
 * Client-side image compression utility for Doulabi marketplace.
 *
 * Workflow: select → resize (max 1200px) → encode to WebP → strip metadata → upload
 *
 * HEIC/HEIF note: iOS Safari natively transcodes HEIC photos to JPEG before
 * exposing them to the browser. No client-side conversion library is needed —
 * browser-image-compression receives a plain JPEG/PNG from the browser API.
 * Running a WASM decoder (heic2any) on top of that caused OOM tab crashes on
 * low-memory iOS devices and has been removed entirely.
 *
 * Key decisions:
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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compresses a single image file to marketplace-quality WebP.
 * In development, logs before/after file sizes to the console.
 */
export async function compressListingImage(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<File> {
  const options: Options = {
    ...LISTING_OPTIONS,
    ...(onProgress ? { onProgress } : {}),
  }

  const compressed = await imageCompression(file, options)
  const result = toNamedWebpFile(compressed, file.name)

  if (process.env.NODE_ENV === 'development') {
    const beforeKB = (file.size / 1024).toFixed(1)
    const afterKB  = (result.size / 1024).toFixed(1)
    const saving   = (((file.size - result.size) / file.size) * 100).toFixed(0)
    console.log(
      `[imageCompression] ${file.name}\n` +
      `  before : ${beforeKB} KB\n` +
      `  after  : ${afterKB} KB  (−${saving}%)`,
    )
  }

  return result
}

/**
 * Compresses a single image to a small thumbnail WebP.
 */
export async function compressThumbnailImage(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<File> {
  const options: Options = {
    ...THUMBNAIL_OPTIONS,
    ...(onProgress ? { onProgress } : {}),
  }

  const compressed = await imageCompression(file, options)
  return toNamedWebpFile(compressed, file.name)
}

/**
 * Batch-compresses an array of files for listing upload.
 * Runs all compressions in parallel (each in its own Web Worker).
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
 */
function toNamedWebpFile(blob: Blob, originalName: string): File {
  const base = originalName
    .replace(/\.[^.]+$/, '')           // strip original extension
    .replace(/[^a-zA-Z0-9_-]/g, '_')  // sanitise to URL-safe chars
    .slice(0, 60)
    || 'image'

  const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return new File([blob], `${base}_${uid}.webp`, { type: 'image/webp' })
}
