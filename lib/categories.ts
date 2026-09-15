/**
 * Canonical product category list — single source of truth shared by the
 * sell form, the admin moderation panel, and the search filters so they
 * can't silently drift out of sync with each other.
 *
 * `products.category` is a free-text column (no ENUM / CHECK constraint —
 * see supabase/schema.sql), so this list is enforced purely at the app
 * layer. "أخرى" (Other) is kept last as the catch-all.
 */
export const CATEGORIES = [
  "فساتين",
  "أحذية",
  "حقائب",
  "إكسسوارات",
  "ملابس رجالية",
  "ملابس أطفال",
  "ملابس تقليدية",
  "عبايات",
  "أطقم و بدل",
  "معاطف وجاكيتات",
  "جامبسوت",
  "ملابس نوم",
  "عطور و تجميل",
  "أخرى",
];
