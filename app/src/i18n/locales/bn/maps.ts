// Bengali de app/src/features/maps/strings.ts. A revisar por falante nativo. As atribuições (MAP_ATTRIBUTIONS) ficam em pt, como licença.
import type { ConfidenceBand } from '@sensus/core';

export const bnMaps = {
  title: 'মানচিত্র',
  loading: 'মানচিত্র লোড হচ্ছে…',
  loadError: 'মানচিত্র লোড করা যায়নি। আপনার সংযোগ পরীক্ষা করুন।',
  noPlaces: 'এই অংশে স্থানাঙ্কসহ কোনো স্থান নেই।',
  scopeSelection: 'নির্বাচন',
  scopeUnit: 'পেরিকোপ',
  scopeBook: 'বই',
  placesCount: (n: number) => (n === 1 ? '1টি স্থান' : `${n}টি স্থান`),
  passageTitle: 'অংশের স্থানসমূহ',
  openMap: 'মানচিত্রে দেখুন',
  fit: 'ফিট করুন',
  legendTitle: 'শনাক্তকরণের নির্ভরযোগ্যতা',
  bands: { high: 'উচ্চ', mid: 'মাঝারি', low: 'নিম্ন', none: 'মূল্যায়ন করা হয়নি' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0.8', mid: '0.5–0.8', low: '< 0.5', none: 'উৎস মূল্যায়ন করে না' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: 'নির্ভরযোগ্যতা',
  identification: 'শনাক্তকরণ',
  coords: 'স্থানাঙ্ক',
  openPlace: 'স্থান খুলুন',
  passages: 'অংশ',
  candidates: 'অন্যান্য আধুনিক শনাক্তকরণ',
  homonyms: 'একই নামের অন্যান্য স্থান',
  sourcesOf: 'উৎস',
  selectedHint: 'স্থান দেখতে একটি চিহ্নে ট্যাপ করুন।',
  close: 'বন্ধ করুন',
  place: 'স্থান',
  placeHint: 'স্থান, তার শনাক্তকরণ ও অংশগুলো দেখতে একটি চিহ্নে ট্যাপ করুন।',
};
