// Hindi de app/src/features/maps/strings.ts. A revisar por falante nativo. As atribuições (MAP_ATTRIBUTIONS) ficam em pt, como licença.
import type { ConfidenceBand } from '@sensus/core';

export const hiMaps = {
  title: 'मानचित्र',
  loading: 'मानचित्र लोड हो रहा है…',
  loadError: 'मानचित्र लोड नहीं हो सका। अपना कनेक्शन जाँचें।',
  noPlaces: 'इस अंश में निर्देशांक वाले कोई स्थान नहीं हैं।',
  scopeSelection: 'चयन',
  scopeUnit: 'पेरिकोप',
  scopeBook: 'पुस्तक',
  placesCount: (n: number) => (n === 1 ? '1 स्थान' : `${n} स्थान`),
  passageTitle: 'अंश के स्थान',
  openMap: 'मानचित्र पर देखें',
  fit: 'फ़िट करें',
  legendTitle: 'पहचान की विश्वसनीयता',
  bands: { high: 'उच्च', mid: 'मध्यम', low: 'निम्न', none: 'मूल्यांकित नहीं' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0.8', mid: '0.5–0.8', low: '< 0.5', none: 'स्रोत मूल्यांकन नहीं करता' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: 'विश्वास',
  identification: 'पहचान',
  coords: 'निर्देशांक',
  openPlace: 'स्थान खोलें',
  passages: 'अंश',
  candidates: 'आधुनिक पहचान के अन्य विकल्प',
  homonyms: 'इसी नाम के अन्य स्थान',
  sourcesOf: 'स्रोत',
  selectedHint: 'स्थान देखने के लिए मार्कर दबाएँ।',
  close: 'बंद करें',
  place: 'स्थान',
  placeHint: 'स्थान, उसकी पहचान और अंश देखने के लिए मार्कर दबाएँ।',
};
