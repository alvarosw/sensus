// Russo de app/src/features/maps/strings.ts. A revisar por falante nativo. As atribuições (MAP_ATTRIBUTIONS) ficam em pt, como licença.
import type { ConfidenceBand } from '@sensus/core';

// Plural russo: 1 / 2-4 / 5+ (os números 11 a 14 seguem a terceira forma).
const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export const ruMaps = {
  title: 'Карта',
  loading: 'Загрузка карты…',
  loadError: 'Не удалось загрузить карту. Проверьте подключение.',
  noPlaces: 'В этом фрагменте нет мест с координатами.',
  scopeSelection: 'Выделение',
  scopeUnit: 'Перикопа',
  scopeBook: 'Книга',
  placesCount: (n: number) => `${n} ${ruPlural(n, 'место', 'места', 'мест')}`,
  passageTitle: 'Места во фрагменте',
  openMap: 'Показать на карте',
  fit: 'Вписать',
  legendTitle: 'Достоверность определения',
  bands: { high: 'высокая', mid: 'средняя', low: 'низкая', none: 'не оценено' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0,8', mid: '0,5–0,8', low: '< 0,5', none: 'источник не оценивает' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: 'Достоверность',
  identification: 'Определение',
  coords: 'Координаты',
  openPlace: 'Открыть место',
  passages: 'Фрагменты',
  candidates: 'Другие современные отождествления',
  homonyms: 'Другие места с этим названием',
  sourcesOf: 'Источники',
  selectedHint: 'Нажмите на маркер, чтобы увидеть место.',
  close: 'Закрыть',
  place: 'Место',
  placeHint: 'Нажмите на маркер, чтобы увидеть место, его отождествление и фрагменты.',
};
