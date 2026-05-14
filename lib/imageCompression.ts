/**
 * lib/imageCompression.ts
 *
 * Client-side image compression for Doulabi marketplace.
 *
 * Workflow: select → native streaming decode + resize → encode to WebP → upload
 *
 * Why no browser-image-compression library:
 *   Modern phone cameras shoot 12–48 MP photos. Decoding a 48 MP JPEG into a
 *   canvas allocates ~195 MB of RGBA pixels BEFORE any resize can happen.
 *   Running that on multiple files in parallel reliably blew past iOS Safari's
 *   ~300 MB per-tab memory ceiling and crashed the page.
 *
 *   createImageBitmap(file, { resizeWidth, resizeHeight }) instead asks the
 *   browser to decode AT the target size. On iOS Safari this hits CoreGraphics'
 *   streaming JPEG decoder — the full-resolution image is never materialised
 *   in memory. Peak allocation drops from 195 MB to ~6 MB per image.
 *
 *   Files are also processed sequentially (not via Promise.all) so peak memory
 *   stays flat at one shrunk image regardless of how many photos the user picks.
 *
 * Tunables:
 *   - MAX_DIMENSION = 1200 px — phones shoot at 12–50 MP; 1200 px is plenty for
 *     e-commerce display and keeps WebP output around 150–350 KB.
 *   - WEBP_QUALITY = 0.80 — sweet-spot for clothing photos.
 *   - THUMB_DIMENSION = 400 px — for preview/thumbnail use cases.
 */

// ── Tunables ──────────────────────────────────────────────────────────────────

const MAX_DIMENSION   = 1200
const THUMB_DIMENSION = 400
const WEBP_QUALITY    = 0.80

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compresses a single image file to marketplace-quality WebP.
 * Uses native streaming decode — safe for huge iPhone photos.
 */
export async function compressListingImage(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<File> {
  return compressToWebp(file, MAX_DIMENSION, WEBP_QUALITY, onProgress, true)
}

/**
 * Compresses a single image to a small thumbnail WebP.
 */
export async function compressThumbnailImage(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<File> {
  return compressToWebp(file, THUMB_DIMENSION, WEBP_QUALITY, onProgress, false)
}

/**
 * Batch-compresses an array of files for listing upload.
 *
 * CRITICAL: processes files SEQUENTIALLY, not in parallel. Parallel processing
 * caused iOS Safari tab crashes because every in-flight decode held its own
 * canvas allocation. Sequential keeps peak memory flat.
 */
export async function compressListingImages(
  files: File[],
  onProgress?: (fileIndex: number, progress: number) => void,
): Promise<File[]> {
  const results: File[] = []

  for (let i = 0; i < files.length; i++) {
    const compressed = await compressListingImage(
      files[i],
      onProgress ? (p) => onProgress(i, p) : undefined,
    )
    results.push(compressed)

    // Yield to the event loop so iOS can run GC between files.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  return results
}

// ── Core pipeline ─────────────────────────────────────────────────────────────

async function compressToWebp(
  file: File,
  maxDimension: number,
  quality: number,
  onProgress: ((progress: number) => void) | undefined,
  devLog: boolean,
): Promise<File> {
  onProgress?.(5)

  // 1. Read raw dimensions cheaply via an <img> element. Safari/iOS does not
  //    fully rasterise the image just to expose naturalWidth/naturalHeight;
  //    it parses the JPEG header only.
  const { width, height } = await readDimensions(file)
  onProgress?.(20)

  // 2. Compute target size capped at maxDimension on the longest edge.
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  const targetW = Math.max(1, Math.round(width  * scale))
  const targetH = Math.max(1, Math.round(height * scale))

  // 3. Decode + resize in a single native call. On iOS Safari this hits the
  //    CoreGraphics streaming decoder, so the full-res pixels never exist in
  //    memory — the bitmap arrives at targetW × targetH directly.
  const bitmap = await createImageBitmap(file, {
    resizeWidth:   targetW,
    resizeHeight:  targetH,
    resizeQuality: 'high',
  })
  onProgress?.(60)

  // 4. Paint to canvas at target size (tiny — under 6 MB even for 1200 px).
  const canvas = document.createElement('canvas')
  canvas.width  = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas 2D context unavailable')
  }
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close() // free decoded pixels immediately
  onProgress?.(80)

  // 5. Encode to WebP. canvas.toBlob does NOT copy EXIF / GPS metadata.
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality)
  })

  // 6. Force the canvas to release its backing store before the next file.
  canvas.width  = 0
  canvas.height = 0

  if (!blob) throw new Error('WebP encoding failed (canvas.toBlob returned null)')

  const result = toNamedWebpFile(blob, file.name)
  onProgress?.(100)

  if (devLog && process.env.NODE_ENV === 'development') {
    const beforeKB = (file.size   / 1024).toFixed(1)
    const afterKB  = (result.size / 1024).toFixed(1)
    const saving   = (((file.size - result.size) / file.size) * 100).toFixed(0)
    console.log(
      `[imageCompression] ${file.name}\n` +
      `  source : ${width}×${height} (${beforeKB} KB)\n` +
      `  output : ${targetW}×${targetH} (${afterKB} KB, −${saving}%)`,
    )
  }

  return result
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Reads naturalWidth/naturalHeight without fully decoding the image.
 * iOS Safari only parses the JPEG SOFn header for these properties.
 */
function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight }
      URL.revokeObjectURL(url)
      img.src = '' // help GC release any partial decode
      resolve(dims)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Could not read image dimensions for ${file.name}`))
    }

    img.src = url
  })
}

/**
 * Wraps a Blob in a File with a clean, unique .webp filename.
 */
function toNamedWebpFile(blob: Blob, originalName: string): File {
  const base = originalName
    .replace(/\.[^.]+$/, '')          // strip original extension
    .replace(/[^a-zA-Z0-9_-]/g, '_')  // sanitise to URL-safe chars
    .slice(0, 60)
    || 'image'

  const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return new File([blob], `${base}_${uid}.webp`, { type: 'image/webp' })
}
