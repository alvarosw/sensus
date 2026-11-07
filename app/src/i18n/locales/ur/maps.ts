// Urdu de app/src/features/maps/strings.ts. A revisar por falante nativo. As atribuições (MAP_ATTRIBUTIONS) ficam em pt, como licença.
import type { ConfidenceBand } from '@sensus/core';

export const urMaps = {
  title: 'نقشہ',
  loading: 'نقشہ لوڈ ہو رہا ہے…',
  loadError: 'نقشہ لوڈ نہیں ہو سکا۔ اپنا کنکشن دیکھیں۔',
  noPlaces: 'اس حصے میں محل وقوع کے نقاط والے کوئی مقام نہیں ہیں۔',
  scopeSelection: 'انتخاب',
  scopeUnit: 'پیریکوپ',
  scopeBook: 'کتاب',
  placesCount: (n: number) => (n === 1 ? '1 مقام' : `${n} مقامات`),
  passageTitle: 'حصے کے مقامات',
  openMap: 'نقشے پر دیکھیں',
  fit: 'فٹ کریں',
  legendTitle: 'شناخت کا اعتماد',
  bands: { high: 'زیادہ', mid: 'درمیانہ', low: 'کم', none: 'درجہ بندی نہیں' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0.8', mid: '0.5–0.8', low: '< 0.5', none: 'ماخذ درجہ بندی نہیں کرتا' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: 'اعتماد',
  identification: 'شناخت',
  coords: 'محل وقوع کے نقاط',
  openPlace: 'مقام کھولیں',
  passages: 'حوالے',
  candidates: 'جدید شناخت کی دیگر صورتیں',
  homonyms: 'اسی نام کے دیگر مقامات',
  sourcesOf: 'ماخذ',
  selectedHint: 'مقام دیکھنے کے لیے نشان پر تھپتھپائیں۔',
  close: 'بند کریں',
  place: 'مقام',
  placeHint: 'مقام، اس کی شناخت اور حوالے دیکھنے کے لیے نشان پر تھپتھپائیں۔',
};
