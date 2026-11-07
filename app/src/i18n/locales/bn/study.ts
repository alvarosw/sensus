// Bengali de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';

export const bnStudy = {
  threadLens: {
    literario: 'আমরা কোথায় আছি',
    lingua: 'যে শব্দ অংশটিকে এগিয়ে নেয়',
    texto: 'পাণ্ডুলিপিগুলো ভিন্ন',
    intertexto: 'অন্য পাঠে প্রতিধ্বনি',
    historico: 'মানুষ, স্থান ও প্রেক্ষাপট',
    interpretacao: 'মণ্ডলী কীভাবে পড়েছে',
    aplicacao: 'এবং আমাদের জন্য',
  },
  sheet: 'নির্বাচিত অংশের অধ্যয়ন',
  expand: 'অধ্যয়ন বড় করুন',
  collapse: 'অধ্যয়ন ছোট করুন',
  close: 'নির্বাচন মুছুন',
  verseCount: (n: number) => `${n} পদ`,
  versesAbbr: (n: number) => `${n} পদ`,
  crosses: (a: string, b: string) => `${a} → ${b} পর্যন্ত বিস্তৃত`,
  pericope: (r: string) => `পেরিকোপ ${r}`,
  pericopeWhole: 'পুরো পেরিকোপ',
  pericopeExpanded: (r: string) => `নির্বাচন পেরিকোপ ${r}-এ বিস্তৃত করা হয়েছে`,
  railLabel: 'অধ্যয়নের দৃষ্টিকোণ',

  factComentaristas: 'ভাষ্যকার',
  factVariantes: (n: number, slash: string) => `পাঠ-ভেদ ${slash}`,
  variantCount: (n: number) => `${n} পাঠ-ভেদ`,
  factXrefs: 'ক্রস-রেফারেন্স',
  factHapax: (t: Testament) => `${testamentLabel(t, 'bn')}-এ হ্যাপাক্স`,
  factVv: (n: number, t: Testament) => `${testamentLabel(t, 'bn')}-এ ${n}টি পদ`,
  factNoData: 'কোনো তথ্য নেই',

  deepen: 'বিস্তারিত',
  seeAll: 'সব দেখুন',
  seeLess: 'কম',
  deepened: 'বিস্তারিত দেখানো হয়েছে',
  deepenPoint: 'এই বিষয়ের বিস্তারিত',
  whereFrom: 'এটি কোথা থেকে এসেছে?',
  askAbout: 'এ বিষয়ে জিজ্ঞাসা করুন',
  openPreview: 'প্রিভিউ খুলুন',

  summaryOfUnit: 'পেরিকোপের সারাংশ',
  summaryContains: 'যেটিতে নির্বাচন আছে',
  noSummary: 'এই বিভাগের কোনো সারাংশ নেই।',
  thinking: 'ভাবছে…',
  noProvider:
    'কোনো AI পদ্ধতি পাওয়া যায়নি। দৃষ্টিকোণ অনুযায়ী সারাংশ দেখতে সেটিংসে ChatGPT দিয়ে সাইন ইন করুন বা একটি API কী যোগ করুন।',
  configure: 'AI সেট আপ করুন',
  summaryError: (m: string) => `সারাংশ তৈরি করা যায়নি: ${m}`,
  retry: 'আবার চেষ্টা করুন',
  panelError: 'এই অংশের উৎসগুলো লোড করা যায়নি।',
  loadingSources: 'উৎস লোড হচ্ছে…',

  lensCount: {
    visao: 'AI · নিচের উৎসগুলো উদ্ধৃত করে',
    aplicacao: 'নিজস্ব কোনো উৎস নেই',
  },

  // সামগ্রিক দৃশ্য (সূত্র)
  threadTitle: 'এই অংশের সূত্র',
  stepsCount: (n: number) => `${n}টি ধাপ`,
  andMore: (n: number) => `আরও ${n}টি`,

  // পাঠ
  translations: 'অনুবাদ ও মূল',
  cmpOriginal: 'মূল',
  originalHint: (nt: string, at: string) =>
    `মূল: NT-এর জন্য ${nt}, OT-এর জন্য ${at}। রূপতত্ত্ব দেখতে একটি শব্দে ট্যাপ করুন।`,
  variantsTitle: 'সংস্করণগুলোর মধ্যে পাঠ-ভেদ',
  variantsEmpty: (list: string) => `এই পদগুলোতে ${list}-এর মধ্যে কোনো পার্থক্য নেই।`,
  variantType: 'পাঠ-ভেদ',
  omits: 'বাদ দেয়',
  analyzeWord: 'শব্দ বিশ্লেষণ করুন',
  ask: 'জিজ্ঞাসা করুন',

  // সাহিত্যিক
  neighborhood: 'আশেপাশের অংশ',
  include: 'অন্তর্ভুক্ত করুন',
  divisions: 'পাঠের বিভাগ',
  division: 'বিভাগ',
  paragraphStart: 'অনুচ্ছেদের শুরু',
  heading: 'শিরোনাম',
  bookIntro: 'বইয়ের ভূমিকা',
  readEntry: 'এন্ট্রি পড়ুন',
  entry: 'এন্ট্রি',
  topicIndex: 'বিষয়সূচি',

  // ঐতিহাসিক
  place: 'স্থান',
  placesHeading: (_n: number) => 'স্থান',
  placesAndEntries: (places: number, entries: number) => `${places}টি স্থান · ${entries}টি এন্ট্রি`,
  peopleGroups: 'ব্যক্তি ও দল',
  dictionaries: 'অভিধান ও বিশ্বকোষ',
  seeEntity: 'সত্তা দেখুন',
  otherPassages: 'অন্যান্য অংশ',
  otherPassagesSoon: 'যেসব অংশে এই সত্তার উল্লেখ আছে, তার তালিকা শীঘ্রই আসছে।',
  entityType: { person: 'ব্যক্তি', place: 'স্থান', event: 'ঘটনা', group: 'দল', other: 'সত্তা' } as Record<string, string>,
  historicalEmpty: 'এই পদগুলোর সঙ্গে সংযুক্ত কোনো স্থান, ব্যক্তি বা এন্ট্রি নেই।',
  timeline: 'কালানুক্রম',
  timelineHere: 'এই অংশে',
  timelineOpen: 'কালানুক্রমে খুলুন',

  // ভাষা
  word: 'শব্দ',
  hapax: 'হ্যাপাক্স',
  commentMentions: (n: number) => `${n}টি ভাষ্যে উদ্ধৃত`,
  lexiconConcordance: 'অভিধান ও কনকর্ডেন্স',
  languageEmpty: 'এই পদগুলোর জন্য মূল পাঠের কোনো শব্দ নেই।',
  inText: 'পাঠে',

  // আন্তঃপাঠ
  xrefType: 'রেফ.',
  from: 'থেকে',
  pinSideBySide: 'পাশাপাশি পিন করুন',
  pinned: (r: string) => `${r} পাঠের উপরে পিন করা`,
  topics: 'বিষয়সূচি',
  xrefsEmpty: 'এই পদগুলোর জন্য কোনো ক্রস-রেফারেন্স নেই।',
  relevance: 'প্রাসঙ্গিকতা',

  // ব্যাখ্যা
  whoComments: 'প্রতিটি পদে কে ভাষ্য লিখেছেন',
  allTraditions: 'সব',
  commentary: 'ভাষ্য',
  readFull: 'সম্পূর্ণ পড়ুন',
  moreByAuthor: 'এই লেখকের আরও',
  onlyAuthor: (a: string) => `শুধু ${a}`,
  clearAuthor: 'সব লেখক',
  commentsEmpty: 'এই পদগুলোর জন্য কোনো ভাষ্য নেই।',
  patristic: 'প্যাট্রিস্টিক',
  matrixLabel: 'প্রতিটি পদে কে ভাষ্য লিখেছেন',

  // প্রয়োগ
  applicationHint: 'প্রয়োগ শুধু AI থেকে আসে এবং সবসময় অনুমান হিসেবে চিহ্নিত থাকে।',
  xrefsCount: (n: number) => `${n}টি সূত্র`,
  commentariesCount: (n: number) => `${n}টি ভাষ্য`,
  chapterMark: (n: number) => `(অধ্যায় ${n})`,
  literaryEmpty: 'এই উৎসে সাহিত্যিক প্রেক্ষাপট নেই।',
  sheetBackHalf: 'অর্ধেক উচ্চতায় ফিরুন',
  sheetToggleHeight: 'পাঠের উচ্চতা বদলান',
};
