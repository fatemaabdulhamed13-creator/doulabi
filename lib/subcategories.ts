/**
 * Sub-category map — keyed by the exact `category` value used in the DB / URL params.
 *
 * Dual keys for traditional wear:
 *   - "ملابس تقليدية"  — value stored in DB (set by SellForm)
 *   - "traditional"    — URL param sent by the homepage category link
 * Both point to the same list so pills appear on the search page regardless
 * of which key the category arrives under.
 *
 * Categories with no sub-categories (أحذية, حقائب, إكسسوارات, ملابس أطفال)
 * are intentionally omitted — absent keys return undefined, which the guards
 * in SellForm and the search page treat as "no sub-categories".
 */
export const SUB_CATEGORIES: Record<string, string[]> = {
  فساتين: [
    "سهرة / زفاف",
    "حفلات بسيطة",
    "كاجوال",
    "بدلات رسمية",
    "محضر",
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
