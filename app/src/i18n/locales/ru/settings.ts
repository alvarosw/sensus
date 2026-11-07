// Russo de app/src/settings/strings.ts. A revisar por falante nativo.
// Plural russo: 1 / 2-4 / 5+ (os números 11 a 14 seguem a terceira forma).
const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export const ruSettings = {
  title: 'Настройки',
  back: 'Назад',
  aiTitle: 'Помощник ИИ',
  lookTitle: 'Оформление и чтение',
  aboutTitle: 'О приложении и лицензии',
  sourcesTitle: 'Источники и лицензии',

  rowAi: 'Помощник ИИ',
  rowLook: 'Оформление и чтение',
  rowAbout: 'О приложении и лицензии',
  rowLanguage: 'Язык',
  langTitle: 'Язык',
  langInUse: 'Используется',
  gearNote: 'Вход: у кнопки «Настройки» слева от надписи появляется шестерёнка.',

  // Assistente: seções
  secAccount: 'Аккаунт ChatGPT · основной',
  secMode: 'Как ИИ отвечает',
  secAdvanced: 'Дополнительно',
  secPrivacy: 'Конфиденциальность',

  // ChatGPT
  chatgptTitle: 'ChatGPT',
  chatgptIntro: 'Используйте тариф ChatGPT (Go, Plus или Pro) для вопросов в Sensus.',
  unavailable: 'Доступно в установленном приложении (сборка для разработки).',
  signIn: 'Войти через ChatGPT',
  signingIn: 'Вход…',
  cancel: 'Отмена',
  reconnect: 'Войти снова',
  retryPlan: 'Повторить',
  grantPlan: 'Разрешить тариф',
  resumeChatGPT: 'Повторить попытку с тарифом',
  signOut: 'Отключить ChatGPT',
  loadModels: 'Загрузить модели',
  loadingModels: 'Загрузка…',
  chatgptModel: 'Модель',
  cancelled: 'Вход отменён.',
  signedOutOk: 'Сеанс завершён.',
  notRevoked: 'Сейчас не удалось отозвать доступ. Отключите Sensus в ChatGPT > Настройки.',
  failed: 'Не удалось завершить. Попробуйте снова.',

  // Modos
  modes: {
    auto: { name: 'Автоматически', help: 'Рекомендуется. Сначала использует ChatGPT. Если тариф исчерпан или возникла ошибка, использует ваш ключ API.' },
    chatgpt: { name: 'Только ChatGPT', help: 'Ключ никогда не используется. Если тариф не отвечает, вопрос покажет ошибку.' },
    key: { name: 'Только ключ API', help: 'Использует только ключ. Аккаунт ChatGPT остаётся подключённым, но не запрашивается.' },
  },
  inUse: 'Сейчас используется',
  chatgptModeNote: 'Не используется в режиме «Только ChatGPT».',

  // Chave de API
  keyTitle: 'Ключ API',
  keyNone: 'Не настроен',
  keyDemo: 'Демонстрация офлайн',
  keySaved: 'ключ сохранён',
  keyDev: 'ключ для разработки',
  provider: 'Провайдер',
  baseUrl: 'Базовый URL',
  apiKey: 'Ключ API',
  apiKeyPlaceholder: 'Вставьте ключ',
  apiKeyMasked: 'Сохранён на этом устройстве',
  change: 'Изменить',
  remove: 'Удалить',
  keyHint: 'Хранится на этом устройстве. Отправляется только выбранному провайдеру.',

  modelField: 'Модель',
  test: 'Проверить соединение',
  testing: 'Проверка…',
  save: 'Сохранить',
  saving: 'Сохранение…',
  saved: 'Настройки сохранены.',
  keyRemoved: 'Ключ удалён с этого устройства.',
  demoHint: 'Демонстрация офлайн: записанные ответы, без ключа и сети.',
  pickModel: 'Модели для чата (нажмите, чтобы выбрать):',
  verify: 'Проверить модель',
  verifying: 'Проверка…',
  verifyOk: '✓ Доступна для ответов.',
  verifyFail: (message: string) => `✗ Недоступна: ${message}`,
  showAllModels: (n: number) => `Показать все (скрыто: ${n})`,
  hideHiddenModels: 'Скрыть лишние',
  hiddenHint: 'Скрытые: эмбеддинги, модели безопасности, переранжировщики, изображения, видео, аудио, перевод, только код и прочие, которые не ведут диалог.',
  moreModels: (shown: number, total: number) => `Показано ${shown} из ${total}. Чтобы выбрать другую, введите её идентификатор в поле «Модель».`,
  removeConfirm: 'Удалить сохранённый ключ с этого устройства?',
  needKey: 'Укажите ключ API.',
  needBaseUrl: 'Укажите базовый URL провайдера.',
  needModel: 'Укажите модель.',
  saveError: (message: string) => `Не удалось сохранить: ${message}`,
  testOk: (count: number) => `Соединение в порядке. ${count} ${ruPlural(count, 'модель для чата доступна', 'модели для чата доступны', 'моделей для чата доступны')}.`,
  testFail: (message: string) => `Ошибка соединения: ${message}`,
  needKeyToTest: 'Укажите ключ API перед проверкой.',

  // Privacidade
  privacyKeys: 'Ключи и токены хранятся только на этом устройстве, в защищённом хранилище системы.',
  privacyOutputs:
    'Ничего, созданное ИИ, не сохраняется: сводки и ответы не записываются. У Sensus нет собственного сервера; вопросы уходят только в ChatGPT или выбранному провайдеру.',

  // Aparência e leitura
  secTheme: 'Тема',
  textLabel: 'текст',
  themeSystem: 'Системная',
  themeLight: 'Светлая',
  themeDark: 'Тёмная',
  themeHelp: 'Системная следует настройке устройства.',
  secReading: 'Чтение',
  textDefault: 'Текст по умолчанию',
  textHelp: 'Также меняется в режиме чтения, кнопкой BLivre.',
  greekTitle: 'Оригинал (TR) под стихами',
  greekHelp: 'По умолчанию выключено. Включается в режиме чтения кнопкой Αα.',

  // Sobre
  version: 'Версия',
  appLicense: 'Лицензия приложения',
  secAttribution: 'Атрибуции',
  sourcesCount: (n: number) => `${n} ${ruPlural(n, 'источник', 'источника', 'источников')} в текущей базе`,
  sourcesLoading: 'Чтение базы…',
  nonCommercial: (title: string) => `${title}: лицензия на некоммерческое использование. Используйте этот материал без коммерческих целей.`,
  attributionHint: 'Каждый источник показывает текст атрибуции, требуемый его лицензией.',
  openSource: 'Открыть источник',
  licenseLink: 'Смотреть лицензию',
  groupCc: 'Creative Commons',
  groupNonCommercial: 'Некоммерческое использование',
  groupPublicDomain: 'Общественное достояние и прочие',
  groupOther: 'Прочие лицензии',
  attributionLabel: 'Атрибуция',
  authorLabel: 'Автор',
  licenseLabel: 'Лицензия',
  sourceLabel: 'Происхождение',
  noSources: 'В базе не найдено ни одного источника.',
  sourceCount: (n: number) => `${n} ${ruPlural(n, 'источник', 'источника', 'источников')}`,
};
