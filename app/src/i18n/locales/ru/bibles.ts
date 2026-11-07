// Russo de app/src/data/bibles/strings.ts. A revisar por falante nativo.
export const ruBibles = {
  title: 'Библии',
  rowTitle: 'Библии',
  rowSubtitle: (n: number) => `Установлено: ${n} ${ruPlural(n, 'Библия', 'Библии', 'Библий')}`,

  installedTitle: 'Установленные',
  recommendedTitle: (lang: string) => `Рекомендуемые для: ${lang}`,
  othersTitle: 'Другие языки',
  recommended: 'Рекомендуемая',
  bundledNote: 'Поставляются с приложением и не могут быть удалены.',
  catalogCached: 'Показан последний сохранённый список. Обновите его, когда будет возможность.',
  catalogError: 'Не удалось обновить список Библий. Проверьте подключение к сети.',
  catalogEmpty: 'Сейчас нет Библий, доступных для загрузки.',
  checking: 'Обновление…',
  refresh: 'Обновить список',

  install: 'Загрузить',
  installed: 'Установлена',
  cancel: 'Отмена',
  resume: 'Продолжить',
  retry: 'Повторить',
  remove: 'Удалить',
  removeTitle: (abbr: string) => `Удалить ${abbr}?`,
  removeBody: 'Текст этой Библии будет удалён с устройства. Чтобы снова им пользоваться, загрузите её заново.',
  removeConfirm: 'Удалить',
  license: (license: string) => `Лицензия: ${license}`,
  size: (size: string) => `${size} для загрузки`,
  progress: (pct: number) => `Загрузка… ${pct}%`,
  phases: {
    checking: 'Подготовка…',
    verifying: 'Проверка файла…',
    extracting: 'Распаковка…',
    installing: 'Установка…',
  },
  paused: 'Загрузка приостановлена. Нажмите «Продолжить», чтобы загрузить снова.',
  errors: {
    manifest: 'Не удалось подготовить эту Библию. Попробуйте снова.',
    network: 'Соединение прервалось во время загрузки. Попробуйте снова.',
    space: 'На устройстве недостаточно места для этой Библии.',
    'app-too-old': 'Эта версия приложения не может открыть эту Библию. Обновите Sensus.',
    schema: 'Эта версия приложения не может открыть эту Библию. Обновите Sensus.',
    checksum: 'Загруженный файл не прошёл проверку. Попробуйте снова.',
    corrupt: 'Загруженный файл неполный. Попробуйте снова.',
    install: 'Не удалось установить. Текст по-прежнему доступен. Попробуйте снова.',
    unsupported: 'Эту Библию можно загрузить только в установленном приложении.',
  },

  readerButton: (label: string) => `Библия текста: ${label}. Сменить`,
  readerTitle: 'Библия текста',
  readerDownloadMore: 'Загрузить другие Библии',
  readerNone: 'Нет установленных Библий.',
  appearanceTitle: 'Библия по умолчанию',
  textHelp: 'Также меняется в режиме чтения, кнопкой Библии на верхней панели. Показываются только установленные Библии.',
  textMore: 'Чтобы загрузить больше, откройте Настройки > Библии.',
};

// Plural russo: 1 / 2-4 / 5+ (os números 11 a 14 seguem a terceira forma).
const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
