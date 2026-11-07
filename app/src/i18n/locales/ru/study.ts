// Russo de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';
import { ruPlural } from '../../plural';

export const ruStudy = {
  threadLens: {
    literario: 'Где мы находимся',
    lingua: 'Слово, которое движет отрывок',
    texto: 'Рукописи расходятся',
    intertexto: 'Отголоски в других текстах',
    historico: 'Люди, места и контекст',
    interpretacao: 'Как читала Церковь',
    aplicacao: 'И для нас',
  },
  sheet: 'Изучение выбранного фрагмента',
  expand: 'Развернуть изучение',
  collapse: 'Свернуть изучение',
  close: 'Снять выделение',
  verseCount: (n: number) => `${n} ${ruPlural(n, 'стих', 'стиха', 'стихов')}`,
  versesAbbr: (n: number) => `${n} ст.`,
  crosses: (a: string, b: string) => `переходит ${a} → ${b}`,
  pericope: (r: string) => `Перикопа ${r}`,
  pericopeWhole: 'Вся перикопа',
  pericopeExpanded: (r: string) => `Выделение расширено до перикопы ${r}`,
  railLabel: 'Линзы изучения',

  factComentaristas: 'комментаторы',
  factVariantes: (n: number, slash: string) => `${ruPlural(n, 'вариант', 'варианта', 'вариантов')} ${slash}`,
  variantCount: (n: number) => `${n} ${ruPlural(n, 'вариант', 'варианта', 'вариантов')}`,
  factXrefs: 'перекрёстные ссылки',
  factHapax: (t: Testament) => `гапакс в ${testamentLabel(t, 'ru')}`,
  /** Contagem de versículos no testamento da palavra. */
  factVv: (n: number, t: Testament) => `${n} ${ruPlural(n, 'стих', 'стиха', 'стихов')} в ${testamentLabel(t, 'ru')}`,
  factNoData: 'Нет данных',

  deepen: 'Подробнее',
  seeAll: 'Смотреть все',
  seeLess: 'Меньше',
  deepened: 'Подробно',
  deepenPoint: 'Подробнее об этом пункте',
  whereFrom: 'Откуда это?',
  askAbout: 'Спросить об этом',
  openPreview: 'Открыть превью',

  summaryOfUnit: 'Сводка перикопы',
  summaryContains: 'содержащей выделение',
  noSummary: 'Нет сводки для этого раздела.',
  thinking: 'думает…',
  noProvider:
    'Способ работы с ИИ недоступен. Войдите через ChatGPT или добавьте ключ API в настройках, чтобы увидеть сводку по линзам.',
  configure: 'Настроить ИИ',
  summaryError: (m: string) => `Не удалось создать сводку: ${m}`,
  retry: 'Повторить',
  panelError: 'Не удалось загрузить источники этого фрагмента.',
  loadingSources: 'Загрузка источников…',

  lensCount: {
    visao: 'ИИ · ссылается на источники ниже',
    aplicacao: 'без собственного источника',
  },

  // Visão geral (o fio)
  threadTitle: 'Нить этого фрагмента',
  stepsCount: (n: number) => `${n} ${ruPlural(n, 'шаг', 'шага', 'шагов')}`,
  andMore: (n: number) => `и ещё ${n}`,

  // Texto
  translations: 'Переводы и оригинал',
  cmpOriginal: 'Оригинал',
  originalHint: (nt: string, at: string) =>
    `Оригинал: ${nt} для НЗ, ${at} для ВЗ. Нажмите на слово, чтобы увидеть морфологию.`,
  variantsTitle: 'Варианты между изданиями',
  variantsEmpty: (list: string) => `Нет различий между ${list} в этих стихах.`,
  variantType: 'Вариант',
  omits: 'опускает',
  analyzeWord: 'Разобрать слово',
  ask: 'Спросить',

  // Literário
  neighborhood: 'Окрестности',
  include: 'включить',
  divisions: 'Деления текста',
  division: 'Деление',
  paragraphStart: 'Начало абзаца',
  heading: 'Заголовок',
  bookIntro: 'Введение к книге',
  readEntry: 'Читать статью',
  entry: 'Статья',
  topicIndex: 'Тематический указатель',

  // Histórico
  place: 'Место',
  placesHeading: (n: number) => ruPlural(n, 'Место', 'Места', 'Мест'),
  placesAndEntries: (places: number, entries: number) => `${places} ${ruPlural(places, 'место', 'места', 'мест')} · ${entries} ${ruPlural(entries, 'статья', 'статьи', 'статей')}`,
  peopleGroups: 'Люди и группы',
  dictionaries: 'Словари и энциклопедии',
  seeEntity: 'Смотреть сущность',
  otherPassages: 'Другие места',
  otherPassagesSoon: 'Список мест, которые упоминают эту сущность, появится скоро.',
  entityType: { person: 'Персона', place: 'Место', event: 'Событие', group: 'Группа', other: 'Сущность' } as Record<string, string>,
  historicalEmpty: 'Нет мест, людей или статей, связанных с этими стихами.',
  timeline: 'Хронология',
  timelineHere: 'в этом фрагменте',
  timelineOpen: 'Открыть в хронологии',

  // Língua
  word: 'Слово',
  hapax: 'гапакс',
  commentMentions: (n: number) => `упоминается в ${n} ${ruPlural(n, 'комментарии', 'комментариях', 'комментариях')}`,
  lexiconConcordance: 'Лексикон и конкорданс',
  languageEmpty: 'Нет слов оригинального текста для этих стихов.',
  inText: 'в тексте',

  // Intertexto
  xrefType: 'Ссыл.',
  from: 'из',
  pinSideBySide: 'Закрепить рядом',
  pinned: (r: string) => `Закреплено над текстом: ${r}`,
  topics: 'Тематические указатели',
  xrefsEmpty: 'Нет перекрёстных ссылок для этих стихов.',
  relevance: 'Релевантность',

  // Interpretação
  whoComments: 'Кто комментирует каждый стих',
  allTraditions: 'Все',
  commentary: 'Комментарий',
  readFull: 'Читать полностью',
  moreByAuthor: 'Ещё у этого автора',
  onlyAuthor: (a: string) => `Только ${a}`,
  clearAuthor: 'Все авторы',
  commentsEmpty: 'Нет комментариев к этим стихам.',
  patristic: 'Патристика',
  matrixLabel: 'Кто комментирует каждый стих',

  // Aplicação
  applicationHint: 'Применение создаётся только ИИ и всегда помечается как вывод.',
  xrefsCount: (n: number) => `${n} ${ruPlural(n, 'ссылка', 'ссылки', 'ссылок')}`,
  commentariesCount: (n: number) => `${n} ${ruPlural(n, 'комментарий', 'комментария', 'комментариев')}`,
  chapterMark: (n: number) => `(глава ${n})`,
  literaryEmpty: 'В этом источнике нет литературного контекста.',
  sheetBackHalf: 'Вернуться к половине высоты',
  sheetToggleHeight: 'Переключить высоту изучения',
};
