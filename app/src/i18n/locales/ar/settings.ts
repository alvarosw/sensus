// Árabe de app/src/settings/strings.ts. A revisar por falante nativo.
// Plural árabe: 1 singular, 2 dual, 3 a 10 plural, 11 ou mais singular.
const arPl = (n: number, one: string, two: string, few: string, many: string): string =>
  n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? few : many;

export const arSettings = {
  title: 'الإعدادات',
  back: 'رجوع',
  aiTitle: 'مساعد الذكاء الاصطناعي',
  lookTitle: 'المظهر والقراءة',
  aboutTitle: 'حول والتراخيص',
  sourcesTitle: 'المصادر والتراخيص',

  rowAi: 'مساعد الذكاء الاصطناعي',
  rowLook: 'المظهر والقراءة',
  rowAbout: 'حول والتراخيص',
  rowLanguage: 'اللغة',
  langTitle: 'اللغة',
  langInUse: 'المستخدمة',
  gearNote: 'المدخل: زر "الإعدادات" يكتسب ترسًا على يسار العنوان.',

  // Assistente: seções
  secAccount: 'حساب ChatGPT · الأساسي',
  secMode: 'كيف يجيب الذكاء الاصطناعي',
  secAdvanced: 'متقدم',
  secPrivacy: 'الخصوصية',

  // ChatGPT
  chatgptTitle: 'ChatGPT',
  chatgptIntro: 'استخدم خطة ChatGPT (Go أو Plus أو Pro) في أسئلة Sensus.',
  unavailable: 'متاح في التطبيق المثبت (نسخة التطوير).',
  signIn: 'تسجيل الدخول بـ ChatGPT',
  signingIn: 'جارٍ تسجيل الدخول…',
  cancel: 'إلغاء',
  reconnect: 'تسجيل الدخول مرة أخرى',
  retryPlan: 'حاول مرة أخرى',
  grantPlan: 'تفعيل الخطة',
  resumeChatGPT: 'حاول الخطة مرة أخرى',
  signOut: 'قطع الاتصال بـ ChatGPT',
  loadModels: 'تحميل النماذج',
  loadingModels: 'جارٍ التحميل…',
  chatgptModel: 'النموذج',
  cancelled: 'أُلغي تسجيل الدخول.',
  signedOutOk: 'انتهت الجلسة.',
  notRevoked: 'تعذّر إلغاء الصلاحية الآن. افصل Sensus من ChatGPT > الإعدادات.',
  failed: 'تعذّر الإكمال. حاول مرة أخرى.',

  // Modos
  modes: {
    auto: {
      name: 'تلقائي',
      help: 'موصى به. يستخدم ChatGPT أولًا. عند بلوغ حد الخطة أو الفشل، يستخدم مفتاح API.',
    },
    chatgpt: { name: 'ChatGPT فقط', help: 'لا يستخدم المفتاح أبدًا. إذا لم تستجب الخطة، يعرض السؤال الخطأ.' },
    key: { name: 'مفتاح API فقط', help: 'يستخدم المفتاح فقط. حساب ChatGPT يبقى متصلًا لكنه لا يُستشار.' },
  },
  inUse: 'مستخدم الآن',
  chatgptModeNote: 'لا يُستخدم في وضع ChatGPT فقط.',

  // Chave de API
  keyTitle: 'مفتاح API',
  keyNone: 'غير مُعَدّ',
  keyDemo: 'عرض توضيحي دون اتصال',
  keySaved: 'مفتاح محفوظ',
  keyDev: 'مفتاح التطوير',
  provider: 'المزوّد',
  baseUrl: 'عنوان URL الأساسي',
  apiKey: 'مفتاح API',
  apiKeyPlaceholder: 'الصق مفتاحك',
  apiKeyMasked: 'محفوظ على هذا الجهاز',
  change: 'تغيير',
  remove: 'إزالة',
  keyHint: 'يبقى على هذا الجهاز. يُرسل فقط إلى المزوّد المختار.',

  modelField: 'النموذج',
  test: 'اختبار الاتصال',
  testing: 'جارٍ الاختبار…',
  save: 'حفظ',
  saving: 'جارٍ الحفظ…',
  saved: 'تم حفظ الإعدادات.',
  keyRemoved: 'تمت إزالة المفتاح من هذا الجهاز.',
  demoHint: 'عرض توضيحي دون اتصال: إجابات مسجلة، بدون مفتاح ولا شبكة.',
  pickModel: 'نماذج الدردشة (اضغط للاختيار):',
  verify: 'التحقق من النموذج',
  verifying: 'جارٍ التحقق…',
  verifyOk: '✓ متاح للإجابات.',
  verifyFail: (message: string) => `✗ غير متاح: ${message}`,
  showAllModels: (n: number) => `عرض الكل (${n} مخفية)`,
  hideHiddenModels: 'إخفاء المخفية',
  hiddenHint:
    'المخفية: التضمينات، وحراس الأمان، ومعيدو الترتيب، والصور، والفيديو، والصوت، والترجمة، ونماذج الشيفرة فقط، وغيرها مما لا يتحدث.',
  moreModels: (shown: number, total: number) =>
    `عرض ${shown} من ${total}. لنموذج آخر، اكتب المعرّف في حقل النموذج.`,
  removeConfirm: 'إزالة المفتاح المحفوظ على هذا الجهاز؟',
  needKey: 'أدخل مفتاح API.',
  needBaseUrl: 'أدخل عنوان URL الأساسي للمزوّد.',
  needModel: 'أدخل النموذج.',
  saveError: (message: string) => `تعذّر الحفظ: ${message}`,
  testOk: (count: number) =>
    `الاتصال ناجح. ${arPl(count, 'نموذج دردشة متاح واحد', 'نموذجا دردشة متاحان', `${count} نماذج دردشة متاحة`, `${count} نموذج دردشة متاح`)}.`,
  testFail: (message: string) => `فشل الاتصال: ${message}`,
  needKeyToTest: 'أدخل مفتاح API قبل الاختبار.',

  // Privacidade
  privacyKeys: 'تبقى المفاتيح والرموز على هذا الجهاز فقط، في التخزين الآمن للنظام.',
  privacyOutputs:
    'لا يُحفظ أي شيء تنتجه الذكاء الاصطناعي: الملخصات والإجابات لا تُحفظ. ليس لدى Sensus خادم خاص؛ الأسئلة تُرسل فقط إلى ChatGPT أو إلى المزوّد المختار.',

  // Aparência e leitura
  secTheme: 'السمة',
  textLabel: 'النص',
  themeSystem: 'النظام',
  themeLight: 'فاتح',
  themeDark: 'داكن',
  themeHelp: 'وضع "النظام" يتبع إعداد الجهاز.',
  secReading: 'القراءة',
  textDefault: 'النص الافتراضي',
  textHelp: 'يتغير أيضًا في القارئ من زر BLivre.',
  greekTitle: 'اليوناني (TR) تحت الآيات',
  greekHelp: 'مُعطّل افتراضيًا. يُفعَّل في القارئ من زر Αα.',

  // Sobre
  version: 'الإصدار',
  appLicense: 'ترخيص التطبيق',
  secAttribution: 'الإسنادات',
  sourcesCount: (n: number) =>
    arPl(
      n,
      'مصدر واحد في قاعدة البيانات الحالية',
      'مصدران في قاعدة البيانات الحالية',
      `${n} مصادر في قاعدة البيانات الحالية`,
      `${n} مصدر في قاعدة البيانات الحالية`,
    ),
  sourcesLoading: 'جارٍ قراءة قاعدة البيانات…',
  nonCommercial: (title: string) => `${title}: ترخيص للاستخدام غير التجاري. استخدم هذا المحتوى لأغراض غير تجارية.`,
  attributionHint: 'كل مصدر يعرض نص الإسناد الذي يتطلبه ترخيصه.',
  openSource: 'فتح المصدر',
  licenseLink: 'عرض الترخيص',
  groupCc: 'Creative Commons',
  groupNonCommercial: 'الاستخدام غير التجاري',
  groupPublicDomain: 'الملك العام وغيره',
  groupOther: 'تراخيص أخرى',
  attributionLabel: 'الإسناد',
  authorLabel: 'المؤلف',
  licenseLabel: 'الترخيص',
  sourceLabel: 'المصدر',
  noSources: 'لم يُعثر على أي مصدر في قاعدة البيانات.',
  sourceCount: (n: number) => arPl(n, 'مصدر', 'مصدران', `${n} مصادر`, `${n} مصدر`),
};
