// Russo de app/src/features/maps/strings.ts. A revisar por falante nativo. As atribuições (MAP_ATTRIBUTIONS) ficam em pt, como licença.
import type { ConfidenceBand } from '@sensus/core';
import { ruPlural } from '../../plural';

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
