// Hindi de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';

export const hiStudy = {
  threadLens: {
    literario: 'हम कहाँ हैं',
    lingua: 'वह शब्द जो अंश को आगे बढ़ाता है',
    texto: 'पांडुलिपियाँ भिन्न हैं',
    intertexto: 'अन्य पाठों में गूँज',
    historico: 'लोग, स्थान और संदर्भ',
    interpretacao: 'कलीसिया ने इसे कैसे पढ़ा',
    aplicacao: 'और हमारे लिए',
  },
  sheet: 'चुने हुए अंश का अध्ययन',
  expand: 'अध्ययन विस्तृत करें',
  collapse: 'अध्ययन सिकोड़ें',
  close: 'चयन हटाएँ',
  verseCount: (n: number) => `${n} पद`,
  versesAbbr: (n: number) => `${n} पद`,
  crosses: (a: string, b: string) => `${a} → ${b} तक फैला है`,
  pericope: (r: string) => `पेरिकोप ${r}`,
  pericopeWhole: 'पूरा पेरिकोप',
  pericopeExpanded: (r: string) => `चयन को पेरिकोप ${r} तक बढ़ाया गया`,
  railLabel: 'अध्ययन के लेंस',

  factComentaristas: 'टीकाकार',
  factVariantes: (n: number, slash: string) => `भेद ${slash}`,
  variantCount: (n: number) => `${n} भेद`,
  factXrefs: 'क्रॉस-संदर्भ',
  factHapax: (t: Testament) => `${testamentLabel(t, 'hi')} में हैपैक्स`,
  /** Contagem de versículos no testamento da palavra; 1 vira "versículo", o resto "vv.". */
  factVv: (n: number, t: Testament) => `${testamentLabel(t, 'hi')} में ${n} पद`,
  factNoData: 'कोई डेटा नहीं',

  deepen: 'विवरण',
  seeAll: 'सभी देखें',
  seeLess: 'कम',
  deepened: 'विस्तृत',
  deepenPoint: 'इस बिंदु का विवरण',
  whereFrom: 'यह कहाँ से आता है?',
  askAbout: 'इस पर पूछें',
  openPreview: 'पूर्वावलोकन खोलें',

  summaryOfUnit: 'पेरिकोप का सार',
  summaryContains: 'जिसमें चयन है',
  noSummary: 'इस भाग का कोई सार नहीं है।',
  thinking: 'सोच रहा है…',
  noProvider:
    'कोई AI विधि उपलब्ध नहीं है। लेंस के अनुसार सार देखने के लिए सेटिंग्स में ChatGPT से साइन इन करें या API कुंजी जोड़ें।',
  configure: 'AI सेट करें',
  summaryError: (m: string) => `सार नहीं बन सका: ${m}`,
  retry: 'फिर से कोशिश करें',
  panelError: 'इस अंश के स्रोत लोड नहीं हो सके।',
  loadingSources: 'स्रोत लोड हो रहे हैं…',

  lensCount: {
    visao: 'AI · नीचे के स्रोतों का उद्धरण देता है',
    aplicacao: 'अपना कोई स्रोत नहीं',
  },

  // सामान्य दृश्य (सूत्र)
  threadTitle: 'इस अंश का सूत्र',
  stepsCount: (n: number) => (n === 1 ? '1 चरण' : `${n} चरण`),
  andMore: (n: number) => `और ${n} अन्य`,

  // पाठ
  translations: 'अनुवाद और मूल',
  cmpOriginal: 'मूल',
  originalHint: (nt: string, at: string) =>
    `मूल: NT के लिए ${nt}, OT के लिए ${at}। रूप-विज्ञान देखने के लिए किसी शब्द पर दबाएँ।`,
  variantsTitle: 'संस्करणों के बीच भेद',
  variantsEmpty: (list: string) => `इन पदों में ${list} के बीच कोई अंतर नहीं है।`,
  variantType: 'भेद',
  omits: 'छोड़ता है',
  analyzeWord: 'शब्द का विश्लेषण',
  ask: 'पूछें',

  // साहित्यिक
  neighborhood: 'आस-पास',
  include: 'शामिल करें',
  divisions: 'पाठ के विभाजन',
  division: 'विभाजन',
  paragraphStart: 'अनुच्छेद का आरंभ',
  heading: 'शीर्षक',
  bookIntro: 'पुस्तक का परिचय',
  readEntry: 'प्रविष्टि पढ़ें',
  entry: 'प्रविष्टि',
  topicIndex: 'विषय-सूची',

  // ऐतिहासिक
  place: 'स्थान',
  placesHeading: (_n: number) => 'स्थान',
  placesAndEntries: (places: number, entries: number) => `${places} स्थान · ${entries} प्रविष्टियाँ`,
  peopleGroups: 'व्यक्ति और समूह',
  dictionaries: 'शब्दकोश और विश्वकोश',
  seeEntity: 'इकाई देखें',
  otherPassages: 'अन्य अंश',
  otherPassagesSoon: 'इस इकाई का उल्लेख करने वाले अंशों की सूची जल्द आएगी।',
  entityType: { person: 'व्यक्ति', place: 'स्थान', event: 'घटना', group: 'समूह', other: 'इकाई' } as Record<string, string>,
  historicalEmpty: 'इन पदों से जुड़े कोई स्थान, व्यक्ति या प्रविष्टियाँ नहीं हैं।',
  timeline: 'कालरेखा',
  timelineHere: 'इस अंश में',
  timelineOpen: 'कालरेखा में खोलें',

  // भाषा
  word: 'शब्द',
  hapax: 'हैपैक्स',
  commentMentions: (n: number) => `${n} ${n === 1 ? 'टीका' : 'टीकाओं'} में उद्धृत`,
  lexiconConcordance: 'शब्दकोश और कॉनकॉर्डेंस',
  languageEmpty: 'इन पदों के लिए मूल पाठ का कोई शब्द नहीं है।',
  inText: 'पाठ में',

  // अंतरपाठ
  xrefType: 'संदर्भ',
  from: 'से',
  pinSideBySide: 'साथ-साथ पिन करें',
  pinned: (r: string) => `${r} पाठ के ऊपर पिन है`,
  topics: 'विषय-सूचियाँ',
  xrefsEmpty: 'इन पदों के लिए कोई क्रॉस-संदर्भ नहीं है।',
  relevance: 'प्रासंगिकता',

  // व्याख्या
  whoComments: 'हर पद पर कौन टीका करता है',
  allTraditions: 'सभी',
  commentary: 'टीका',
  readFull: 'पूरा पढ़ें',
  moreByAuthor: 'इस लेखक की और',
  onlyAuthor: (a: string) => `केवल ${a}`,
  clearAuthor: 'सभी लेखक',
  commentsEmpty: 'इन पदों के लिए कोई टीका नहीं है।',
  patristic: 'पैट्रिस्टिक',
  matrixLabel: 'हर पद पर कौन टीका करता है',

  // अनुप्रयोग
  applicationHint: 'व्यावहारिक अनुप्रयोग केवल AI से आता है और हमेशा अनुमान के रूप में चिह्नित होता है।',
  xrefsCount: (n: number) => `${n} संदर्भ`,
  commentariesCount: (n: number) => `${n} ${n === 1 ? 'टिप्पणी' : 'टिप्पणियाँ'}`,
  chapterMark: (n: number) => `(अध्याय ${n})`,
  literaryEmpty: 'इस स्रोत में साहित्यिक संदर्भ नहीं है।',
  sheetBackHalf: 'आधी ऊँचाई पर वापस जाएँ',
  sheetToggleHeight: 'अध्ययन की ऊँचाई बदलें',
};
