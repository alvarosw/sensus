// Árabe de app/src/features/maps/strings.ts. A revisar por falante nativo. As atribuições (MAP_ATTRIBUTIONS) ficam em pt, como licença.
import type { ConfidenceBand } from '@sensus/core';
import { arPlural } from '../../plural';
export const arMaps = {
  title: 'الخريطة',
  loading: 'جارٍ تحميل الخريطة…',
  loadError: 'تعذّر تحميل الخريطة. تحقّق من الاتصال.',
  noPlaces: 'لا توجد أماكن ذات إحداثيات في هذا المقطع.',
  scopeSelection: 'التحديد',
  scopeUnit: 'الفقرة الكتابية',
  scopeBook: 'السفر',
  placesCount: (n: number) => arPlural(n, 'مكان واحد', 'مكانان', `${n} أماكن`, `${n} مكان`),
  passageTitle: 'أماكن المقطع',
  openMap: 'عرض على الخريطة',
  fit: 'ملاءمة',
  legendTitle: 'درجة الثقة في التعرف',
  bands: { high: 'عالية', mid: 'متوسطة', low: 'منخفضة', none: 'غير مقيّمة' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0.8', mid: '0.5–0.8', low: '< 0.5', none: 'المصدر لا يقيّمها' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: 'الثقة',
  identification: 'التعرف',
  coords: 'الإحداثيات',
  openPlace: 'فتح المكان',
  passages: 'المقاطع',
  candidates: 'تعرّفات حديثة أخرى',
  homonyms: 'أماكن أخرى بهذا الاسم',
  sourcesOf: 'المصادر',
  selectedHint: 'اضغط على علامة لعرض المكان.',
  close: 'إغلاق',
  place: 'المكان',
  placeHint: 'اضغط على علامة لعرض المكان وتعرّفه والمقاطع.',
};
