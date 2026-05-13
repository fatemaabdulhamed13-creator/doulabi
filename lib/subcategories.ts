/**
 * Sub-category map — keyed by the exact `category` value used in the DB / URL params.
 *
 * Dual keys for traditional wear:
 *   - "ملابس تقليدية"  — value stored in DB (set by SellForm)
 *   - "traditional"    — URL param sent by the homepage category link
 * Both point to the same list so pills appear on the search page regardless
 * of which key the category arrives under.
 *
 * أحذية / حقائب / إكسسوارات use the same Arabic string in the SellForm,
 * the DB, and the homepage URL params — so one key covers all three contexts.
 */
export const SUB_CATEGORIES: Record<string, string[]> = {
  فساتين: [
    "سهرة / زفاف",
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

  // SellForm stores this Arabic string as the category value
  "ملابس تقليدية": [
    "بدلة كبيرة",
    "بدلة صغيرة",
    "بودري",
    "رداء",
    "تكشيطة",
    "عبايات",
  ],

  // Homepage links to ?category=traditional — same list, different key
  traditional: [
    "بدلة كبيرة",
    "بدلة صغيرة",
    "بودري",
    "رداء",
    "تكشيطة",
    "عبايات",
  ],
}
