/**
 * Sub-category map — keyed by the exact `category` value used in the DB / URL params.
 *
 * Every key here matches the canonical category string in lib/categories.ts
 * exactly — the homepage category links, SellForm, and the DB all use the
 * same Arabic string, so one key covers all three contexts.
 */
export const SUB_CATEGORIES: Record<string, string[]> = {
  فساتين: [
    "سهرة / زفاف",
    "فيلو",
    "حفلات بسيطة",
    "كاجوال",
    "بدلات رسمية",
    "محضر",
  ],

  أحذية: [
    "كعب عالي",
    "شبشب",
    "بوت",
    "سنيكر",
    "صندل",
    "موكاسان",
  ],

  حقائب: [
    "حقيبة يد",
    "حقيبة كتف",
    "كلتش",
    "حقيبة ظهر",
    "محفظة",
    "حقيبة سفر",
    "شنطة سفر كبيرة",
  ],

  إكسسوارات: [
    "مجوهرات",
    "ساعات",
    "نظارات",
    "أوشحة وشالات",
    "أحزمة",
    "قبعات",
  ],

  // SellForm stores this Arabic string as the category value. عبايات is
  // its own top-level category now (see lib/categories.ts) — no longer
  // listed here too, which would make it ambiguous which top-level
  // category an abaya listing belongs under.
  "ملابس تقليدية": [
    "بدلة كبيرة",
    "بدلة صغيرة",
    "بودري",
    "رداء",
    "تكشيطة",
  ],
}
