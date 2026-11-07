// Árabe de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';
import { arPlural } from '../../plural';
export const arStudy = {
  sheet: 'دراسة المقطع المحدد',
  expand: 'توسيع الدراسة',
  collapse: 'تصغير الدراسة',
  close: 'مسح التحديد',
  verseCount: (n: number) => `${n} ${arPlural(n, 'آية', 'آيتان', 'آيات', 'آية')}`,
  versesAbbr: (n: number) => `${n} ${arPlural(n, 'آية', 'آيتان', 'آيات', 'آية')}`,
  crosses: (a: string, b: string) => `يمتد من ${a} إلى ${b}`,
  pericope: (r: string) => `الفقرة الكتابية ${r}`,
  pericopeWhole: 'الفقرة الكتابية كاملة',
  pericopeExpanded: (r: string) => `تم توسيع التحديد إلى الفقرة الكتابية ${r}`,
  railLabel: 'عدسات الدراسة',

  factComentaristas: 'المفسّرون',
  factVariantes: (n: number, slash: string) => `${arPlural(n, 'قراءة بديلة', 'قراءتان بديلتان', 'قراءات بديلة', 'قراءة بديلة')} ${slash}`,
  variantCount: (n: number) => `${n} ${arPlural(n, 'قراءة بديلة', 'قراءتان بديلتان', 'قراءات بديلة', 'قراءة بديلة')}`,
  factXrefs: 'شواهد مرجعية',
  factHapax: (t: Testament) => `لفظة فريدة في ${testamentLabel(t, 'ar')}`,
  /** Contagem de versículos no testamento da palavra; 1 vira "versículo", o resto "vv.". */
  factVv: (n: number, t: Testament) => `${n} ${arPlural(n, 'آية', 'آيتان', 'آيات', 'آية')} في ${testamentLabel(t, 'ar')}`,
  factNoData: 'لا توجد بيانات',

  deepen: 'تفصيل',
  seeAll: 'عرض الكل',
  seeLess: 'أقل',
  deepened: 'مفصّل',
  deepenPoint: 'تفصيل هذه النقطة',
  whereFrom: 'من أين يأتي هذا؟',
  askAbout: 'اسأل عن هذا',
  openPreview: 'فتح المعاينة',

  summaryOfUnit: 'ملخص الفقرة الكتابية',
  summaryContains: 'التي تحتوي على التحديد',
  noSummary: 'لا يوجد ملخص لهذا القسم.',
  thinking: 'جارٍ التفكير…',
  noProvider:
    'لا توجد طريقة ذكاء اصطناعي متاحة. سجّل الدخول بـ ChatGPT أو أضف مفتاح API في الإعدادات لعرض الملخص حسب كل عدسة.',
  configure: 'إعداد الذكاء الاصطناعي',
  summaryError: (m: string) => `تعذّر إنشاء الملخص: ${m}`,
  retry: 'حاول مرة أخرى',
  panelError: 'تعذّر تحميل مصادر هذا المقطع.',
  loadingSources: 'جارٍ تحميل المصادر…',

  lensCount: {
    visao: 'ذكاء اصطناعي · يستشهد بالمصادر أدناه',
    aplicacao: 'بلا مصادر خاصة',
  },

  // Visão geral (o fio)
  threadTitle: 'خيط هذا المقطع',
  stepsCount: (n: number) => arPlural(n, 'خطوة واحدة', 'خطوتان', `${n} خطوات`, `${n} خطوة`),
  andMore: (n: number) => `و${n} أخرى`,

  // Texto
  translations: 'الترجمات والأصل',
  cmpBlivre: 'Bíblia Livre',
  cmpKjv: 'KJV',
  cmpOriginal: 'الأصل',
  originalHint: (nt: string, at: string) =>
    `الأصل: ${nt} للعهد الجديد، و${at} للعهد القديم. اضغط على كلمة لعرض صرفها.`,
  variantsTitle: 'الاختلافات بين الطبعات',
  variantsEmpty: (list: string) => `لا توجد اختلافات بين ${list} في هذه الآيات.`,
  variantType: 'القراءة البديلة',
  omits: 'يحذف',
  analyzeWord: 'تحليل الكلمة',
  ask: 'اسأل',

  // Literário
  neighborhood: 'السياق المحيط',
  include: 'تضمين',
  divisions: 'تقسيمات النص',
  division: 'تقسيم',
  paragraphStart: 'بداية فقرة',
  heading: 'عنوان',
  bookIntro: 'مقدمة السفر',
  readEntry: 'قراءة المدخل',
  entry: 'مدخل',
  topicIndex: 'الفهرس الموضوعي',

  // Histórico
  place: 'المكان',
  placesHeading: (n: number) => n > 1 ? 'الأماكن' : 'المكان',
  placesAndEntries: (places: number, entries: number) => `${places} ${arPlural(places, 'مكان', 'مكانان', 'أماكن', 'مكان')} · ${entries} ${arPlural(entries, 'مدخل', 'مدخلان', 'مداخل', 'مدخل')}`,
  peopleGroups: 'الأشخاص والجماعات',
  dictionaries: 'القواميس والموسوعات',
  seeEntity: 'عرض الكيان',
  otherPassages: 'مقاطع أخرى',
  otherPassagesSoon: 'قائمة المقاطع التي تذكر هذا الكيان ستتوفر قريبًا.',
  entityType: { person: 'شخص', place: 'مكان', event: 'حدث', group: 'جماعة', other: 'كيان' } as Record<string, string>,
  historicalEmpty: 'لا توجد أماكن أو أشخاص أو مداخل مرتبطة بهذه الآيات.',
  timeline: 'الخط الزمني',
  timelineHere: 'في هذا المقطع',
  timelineOpen: 'فتح في الخط الزمني',

  // Língua
  word: 'الكلمة',
  hapax: 'لفظة فريدة',
  commentMentions: (n: number) => `مذكورة في ${n} ${arPlural(n, 'تفسير', 'تفسيران', 'تفاسير', 'تفسير')}`,
  lexiconConcordance: 'المعجم وفهرس الكلمات',
  languageEmpty: 'لا توجد كلمات من النص الأصلي لهذه الآيات.',
  inText: 'في النص',

  // Intertexto
  xrefType: 'مرجع',
  from: 'من',
  pinSideBySide: 'تثبيت جنبًا إلى جنب',
  pinned: (r: string) => `${r} مثبت فوق النص`,
  topics: 'الفهارس الموضوعية',
  xrefsEmpty: 'لا توجد شواهد مرجعية لهذه الآيات.',
  relevance: 'الصلة',

  // Interpretação
  whoComments: 'من يفسّر كل آية',
  allTraditions: 'الكل',
  commentary: 'التفسير',
  readFull: 'قراءة كاملة',
  moreByAuthor: 'المزيد لهذا المؤلف',
  onlyAuthor: (a: string) => `${a} فقط`,
  clearAuthor: 'كل المؤلفين',
  commentsEmpty: 'لا توجد تفاسير لهذه الآيات.',
  patristic: 'آباء الكنيسة',
  matrixLabel: 'من يفسّر كل آية',

  // Aplicação
  applicationHint: 'التطبيق يأتي من الذكاء الاصطناعي وحده ويُعرض دائمًا كاستنتاج.',
};
