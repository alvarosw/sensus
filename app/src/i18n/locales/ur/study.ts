// Urdu de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';

export const urStudy = {
  sheet: 'منتخب حصے کا مطالعہ',
  expand: 'مطالعہ بڑا کریں',
  collapse: 'مطالعہ چھوٹا کریں',
  close: 'انتخاب صاف کریں',
  verse: 'آیت',
  verses: 'آیات',
  crosses: (a: string, b: string) => `${a} → ${b} تک پھیلا ہوا`,
  pericope: (r: string) => `پیریکوپ ${r}`,
  pericopeWhole: 'پورا پیریکوپ',
  pericopeExpanded: (r: string) => `انتخاب کو پیریکوپ ${r} تک بڑھا دیا گیا`,
  railLabel: 'مطالعے کے زاویے',

  factComentaristas: 'مفسرین',
  factVariante: (slash: string) => `اختلاف ${slash}`,
  factVariantes: (slash: string) => `اختلافات ${slash}`,
  factXrefs: 'حوالہ جاتی ربط',
  factHapax: (t: Testament) => `${testamentLabel(t, 'ur')} میں ہیپیکس`,
  /** Contagem de versículos no testamento da palavra; 1 vira "versículo", o resto "vv.". */
  factVv: (n: number, t: Testament) => `${testamentLabel(t, 'ur')} میں ${n} آیات`,
  factNoData: 'کوئی ڈیٹا نہیں',

  deepen: 'تفصیل',
  seeAll: 'سب دیکھیں',
  seeLess: 'کم',
  deepened: 'تفصیل کے ساتھ',
  deepenPoint: 'اس نکتے کی تفصیل',
  whereFrom: 'یہ کہاں سے آیا ہے؟',
  askAbout: 'اس کے بارے میں پوچھیں',
  openPreview: 'پیش نظارہ کھولیں',

  summaryOfUnit: 'پیریکوپ کا خلاصہ',
  summaryContains: 'جس میں انتخاب شامل ہے',
  noSummary: 'اس حصے کا کوئی خلاصہ نہیں۔',
  thinking: 'سوچ رہا ہے…',
  noProvider:
    'کوئی AI طریقہ دستیاب نہیں۔ زاویے کے مطابق خلاصہ دیکھنے کے لیے ترتیبات میں ChatGPT سے سائن ان کریں یا API کلید شامل کریں۔',
  configure: 'AI ترتیب دیں',
  summaryError: (m: string) => `خلاصہ نہیں بن سکا: ${m}`,
  retry: 'دوبارہ کوشش کریں',
  panelError: 'اس حصے کے ماخذ لوڈ نہیں ہو سکے۔',
  loadingSources: 'ماخذ لوڈ ہو رہے ہیں…',

  lensCount: {
    visao: 'AI · نیچے کے ماخذ کا حوالہ دیتا ہے',
    aplicacao: 'اپنا کوئی ماخذ نہیں',
  },

  // مجموعی جائزہ (دھاگہ)
  threadTitle: 'اس حصے کا دھاگہ',
  stepsCount: (n: number) => (n === 1 ? '1 قدم' : `${n} قدم`),
  andMore: (n: number) => `اور ${n} مزید`,

  // متن
  translations: 'تراجم اور اصل',
  cmpBlivre: 'Bíblia Livre',
  cmpKjv: 'KJV',
  cmpOriginal: 'اصل',
  originalHint: (nt: string, at: string) =>
    `اصل: NT کے لیے ${nt}، OT کے لیے ${at}۔ صرف و نحو دیکھنے کے لیے کسی لفظ پر تھپتھپائیں۔`,
  variantsTitle: 'ایڈیشنز کے درمیان اختلافات',
  variantsEmpty: (list: string) => `ان آیات میں ${list} کے درمیان کوئی فرق نہیں۔`,
  variantType: 'اختلاف',
  omits: 'حذف کرتا ہے',
  analyzeWord: 'لفظ کا تجزیہ کریں',
  ask: 'پوچھیں',

  // ادبی
  neighborhood: 'گردونواح',
  include: 'شامل کریں',
  divisions: 'متن کی تقسیم',
  division: 'تقسیم',
  paragraphStart: 'پیراگراف کا آغاز',
  heading: 'عنوان',
  bookIntro: 'کتاب کا تعارف',
  readEntry: 'اندراج پڑھیں',
  entry: 'اندراج',
  topicIndex: 'موضوعاتی اشاریہ',

  // تاریخی
  place: 'مقام',
  places: 'مقامات',
  peopleGroups: 'شخصیات اور گروہ',
  dictionaries: 'لغات اور انسائیکلوپیڈیا',
  seeEntity: 'ہستی دیکھیں',
  otherPassages: 'دیگر حوالے',
  otherPassagesSoon: 'اس ہستی کا ذکر کرنے والے حوالوں کی فہرست جلد آ رہی ہے۔',
  entityType: { person: 'شخصیت', place: 'مقام', event: 'واقعہ', group: 'گروہ', other: 'ہستی' } as Record<string, string>,
  historicalEmpty: 'ان آیات سے جڑے کوئی مقامات، شخصیات یا اندراجات نہیں ہیں۔',
  timeline: 'زمانی ترتیب',
  timelineHere: 'اس حصے میں',
  timelineOpen: 'زمانی ترتیب میں کھولیں',

  // زبان
  word: 'لفظ',
  hapax: 'ہیپیکس',
  commentMentions: (n: number) => `${n} ${n === 1 ? 'تفسیر' : 'تفاسیر'} میں حوالہ`,
  lexiconConcordance: 'لغت اور کنکورڈنس',
  languageEmpty: 'ان آیات کے لیے اصل متن کا کوئی لفظ نہیں ہے۔',
  inText: 'متن میں',

  // بین المتنی
  xrefType: 'حوالہ',
  from: 'سے',
  pinSideBySide: 'ساتھ ساتھ پن کریں',
  pinned: (r: string) => `${r} متن کے اوپر پن ہے`,
  topics: 'موضوعاتی اشاریے',
  xrefsEmpty: 'ان آیات کے لیے کوئی حوالہ جاتی ربط نہیں ہے۔',
  relevance: 'مطابقت',

  // تفسیر
  whoComments: 'ہر آیت پر کون تبصرہ کرتا ہے',
  allTraditions: 'سب',
  commentary: 'تفسیر',
  readFull: 'مکمل پڑھیں',
  moreByAuthor: 'اس مصنف کی مزید تحریریں',
  onlyAuthor: (a: string) => `صرف ${a}`,
  clearAuthor: 'تمام مصنفین',
  commentsEmpty: 'ان آیات کے لیے کوئی تفسیر نہیں ہے۔',
  patristic: 'آبائی',
  matrixLabel: 'ہر آیت پر کون تبصرہ کرتا ہے',

  // اطلاق
  applicationHint: 'اطلاق صرف AI سے آتا ہے اور ہمیشہ قیاس کے طور پر نشان زد ہوتا ہے۔',
};
