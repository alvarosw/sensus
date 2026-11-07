// Russo de app/src/features/reader/strings.ts. A revisar por falante nativo.
export const ruReader = {
  books: 'Книги',
  currentRef: (name: string) => `${name}. Перейти к…`,
  jumpPlaceholder: 'Перейти к… например: Флп 2:5',
  jumpLabel: 'Перейти к ссылке',
  jumpNote: 'Непрерывная прокрутка: следующая глава загружается, когда вы дойдёте до конца.',
  jumpUnknown: 'Не распознаю эту ссылку.',
  greek: 'Оригинал (TR для НЗ, WLC для ВЗ) под выделенными стихами',
  greekOn: 'Оригинал под выделенными стихами',
  greekOff: 'Оригинал скрыт',
  textSource: (label: string) => `Источник текста: ${label}. Переключить`,
  verse: (n: number) => `Стих ${n}`,
  reduced: (ref: string) => `Выделение сокращено до ${ref}`,
  undo: 'Отменить',
  handleStart: 'Начало выделения',
  handleEnd: 'Конец выделения',
  bookEdge: (book: string, chapter: number) => `↑ ${book} ${chapter} · продолжайте прокручивать вверх`,
  bookSub: (source: string) => `${source} · непрерывная прокрутка`,
  endOfBible: 'Конец Писания',
  unpin: 'Открепить',
  loading: 'Загрузка текста…',
  loadError: 'Не удалось загрузить текст.',
  retry: 'Повторить',
  // seletor de livros
  pickBook: 'Книги',
  testamentOT: 'ВЗ',
  testamentNT: 'НЗ',
  chaptersOf: (n: number) => `${n} ${ruPlural(n, 'глава', 'главы', 'глав')}`,
  chapterAria: (name: string, n: number) => `${name} ${n}`,
  settings: 'Настройки',
  close: 'Закрыть',
  back: 'К книгам',
};

// Plural russo: 1 / 2-4 / 5+ (os números 11 a 14 seguem a terceira forma).
const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
