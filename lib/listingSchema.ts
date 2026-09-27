import { z } from 'zod'

/** Validation rules for listing fields, used when a seller edits a listing on the website. */
export const coreListingFields = z.object({
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
