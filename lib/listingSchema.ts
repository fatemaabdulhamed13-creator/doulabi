/**
 * lib/listingSchema.ts
 *
 * Zod schemas that define the validation rules for listing creation.
 *
 * Two schemas exist to handle the draft vs. published distinction:
 *
 *  - draftListingSchema   — permissive on images (0–8). Used when saving a draft.
 *  - publishListingSchema — extends draft schema and strictly requires ≥ 3 images.
 *
 * The server action receives a `publish` flag in FormData and selects the
 * appropriate schema so the 3-image rule is only enforced on the live path.
 */

import { z } from 'zod'

// ── Constants ────────────────────────────────────────────────────────────────

/** Accepted MIME types for uploaded images. HEIC/HEIF are allowed here as a
 *  fallback safety net; in practice the client converts them to WebP before upload. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

/** Hard per-file size cap before compression (15 MB). Prevents browser OOM. */
export const MAX_RAW_FILE_SIZE_BYTES = 15 * 1024 * 1024 // 15 MB

/** Minimum images required to publish (not draft). */
export const MIN_IMAGES_TO_PUBLISH = 3

/** Maximum images allowed per listing. */
export const MAX_IMAGES = 8

// ── Image-array refinement ───────────────────────────────────────────────────

/**
 * Validates a File[] array against type and size constraints.
 * Used client-side (pre-compression gate) and can be adapted for server use.
 */
export const imageFileSchema = z
  .custom<File>((v) => v instanceof File, { message: 'يجب أن يكون ملف صورة.' })
  .refine(
    (f) => ACCEPTED_IMAGE_TYPES.includes(f.type as (typeof ACCEPTED_IMAGE_TYPES)[number]),
    { message: 'نوع الملف غير مدعوم. يُقبل: JPEG، PNG، WebP فقط.' },
  )
  .refine(
    (f) => f.size <= MAX_RAW_FILE_SIZE_BYTES,
    { message: 'حجم الصورة كبير جداً. الحد الأقصى 15 ميغابايت لكل صورة.' },
  )

// ── Core listing fields ──────────────────────────────────────────────────────

const coreListingFields = z.object({
  title:             z.string().min(3,  'عنوان الإعلان قصير جداً.').max(120, 'عنوان الإعلان طويل جداً.').trim(),
  price:             z.coerce.number().min(0, 'يجب أن يكون السعر 0 أو أكثر.'),
  category:          z.string().min(1, 'الرجاء اختيار الفئة.').trim(),
  brand:             z.string().min(1, 'الرجاء اختيار الماركة.').trim(),
  size_type:         z.string().min(1).trim(),
  size_value:        z.string().min(1, 'الرجاء اختيار المقاس.').trim(),
  condition:         z.string().min(1, 'الرجاء اختيار حالة المنتج.').trim(),
  description:       z.string().max(500).trim().optional(),
  is_open_to_offers: z.boolean(),
  delivery_available:z.boolean(),
  color:             z.string().trim().optional(),
  city:              z.string().trim().optional(),
  subcategory:       z.string().trim().optional(),
})

// ── Draft schema  (0 images allowed) ────────────────────────────────────────

export const draftListingSchema = coreListingFields.extend({
  /** For the server, images arrive as File[]; count is the only concern. */
  imageCount: z
    .number()
    .int()
    .min(0)
    .max(MAX_IMAGES, `لا يمكن رفع أكثر من ${MAX_IMAGES} صور.`),
})

// ── Publish schema  (minimum 3 images enforced) ──────────────────────────────

export const publishListingSchema = draftListingSchema.extend({
  imageCount: z
    .number()
    .int()
    .min(
      MIN_IMAGES_TO_PUBLISH,
      'الرجاء رفع 3 صور على الأقل لضمان قبول إعلانك',
    )
    .max(MAX_IMAGES, `لا يمكن رفع أكثر من ${MAX_IMAGES} صور.`),
})

export type CoreListingFields = z.infer<typeof coreListingFields>
export type PublishListingInput = z.infer<typeof publishListingSchema>
