// Inglês de app/src/features/study/strings.ts (folha de estudo: lentes, cartões, fio e resumo por IA).
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';

export const enStudy = {
  sheet: 'Study of the selected passage',
  expand: 'Expand study',
  collapse: 'Reduce study',
  close: 'Clear selection',
  verse: 'verse',
  verses: 'verses',
  crosses: (a: string, b: string) => `crosses ${a} → ${b}`,
  pericope: (r: string) => `Pericope ${r}`,
  pericopeWhole: 'Whole pericope',
  pericopeExpanded: (r: string) => `Selection expanded to the pericope ${r}`,
  railLabel: 'Study lenses',

  factComentaristas: 'commentators',
  factVariante: (slash: string) => `variant ${slash}`,
  factVariantes: (slash: string) => `variants ${slash}`,
  factXrefs: 'cross-refs',
  factHapax: (t: Testament) => `hapax in the ${testamentLabel(t, 'en')}`,
  /** Contagem de versículos no testamento da palavra; 1 vira "versículo", o resto "vv.". */
  factVv: (n: number, t: Testament) => `${n} ${n === 1 ? 'verse' : 'vv.'} in the ${testamentLabel(t, 'en')}`,
  factNoData: 'No data',

  deepen: 'Detail',
  seeAll: 'See all',
  seeLess: 'Less',
  deepened: 'Detailed',
  deepenPoint: 'Detail this point',
  whereFrom: 'Where does this come from?',
  askAbout: 'Ask about this',
  openPreview: 'Open preview',

  summaryOfUnit: 'Pericope summary',
  summaryContains: 'containing the selection',
  noSummary: 'No summary for this section.',
  thinking: 'thinking…',
  noProvider:
    'No AI method available. Sign in with ChatGPT or add an API key in the settings to see the summary per lens.',
  configure: 'Set up AI',
  summaryError: (m: string) => `Could not generate the summary: ${m}`,
  retry: 'Try again',
  panelError: 'Could not load the sources for this passage.',
  loadingSources: 'Loading sources…',

  lensCount: {
    visao: 'AI · cites the sources below',
    aplicacao: 'no sources of its own',
  },

  // Visão geral (o fio)
  threadTitle: 'The thread of this passage',
  stepsCount: (n: number) => `${n} ${n === 1 ? 'step' : 'steps'}`,
  andMore: (n: number) => `and ${n} more`,

  // Texto
  translations: 'Translations and original',
  cmpBlivre: 'Bíblia Livre',
  cmpKjv: 'KJV',
  cmpOriginal: 'Original',
  originalHint: (nt: string, at: string) =>
    `Original: ${nt} for the NT, ${at} for the OT. Tap a word to see its morphology.`,
  variantsTitle: 'Variants between editions',
  variantsEmpty: (list: string) => `No differences between ${list} in these verses.`,
  variantType: 'Variant',
  omits: 'omits',
  analyzeWord: 'Analyze word',
  ask: 'Ask',

  // Literário
  neighborhood: 'Surroundings',
  include: 'include',
  divisions: 'Text divisions',
  division: 'Division',
  paragraphStart: 'Paragraph start',
  heading: 'Heading',
  bookIntro: 'Introduction to the book',
  readEntry: 'Read entry',
  entry: 'Entry',
  topicIndex: 'Topical index',

  // Histórico
  place: 'Place',
  places: 'Places',
  peopleGroups: 'People and groups',
  dictionaries: 'Dictionaries and encyclopedias',
  seeEntity: 'See entity',
  otherPassages: 'Other passages',
  otherPassagesSoon: 'The list of passages that mention this entity is coming soon.',
  entityType: { person: 'Person', place: 'Place', event: 'Event', group: 'Group', other: 'Entity' } as Record<string, string>,
  historicalEmpty: 'No places, people or entries linked to these verses.',
  timeline: 'Timeline',
  timelineHere: 'in this passage',
  timelineOpen: 'Open in the timeline',

  // Língua
  word: 'Word',
  hapax: 'hapax',
  commentMentions: (n: number) => `cited in ${n} ${n === 1 ? 'commentary' : 'commentaries'}`,
  lexiconConcordance: 'Lexicon and concordance',
  languageEmpty: 'No words from the original text for these verses.',
  inText: 'in the text',

  // Intertexto
  xrefType: 'Ref.',
  from: 'from',
  pinSideBySide: 'Pin side by side',
  pinned: (r: string) => `${r} pinned above the text`,
  topics: 'Topical indexes',
  xrefsEmpty: 'No cross-references for these verses.',
  relevance: 'Relevance',

  // Interpretação
  whoComments: 'Who comments on each verse',
  allTraditions: 'All',
  commentary: 'Commentary',
  readFull: 'Read in full',
  moreByAuthor: 'More by this author',
  onlyAuthor: (a: string) => `Only ${a}`,
  clearAuthor: 'All authors',
  commentsEmpty: 'No commentaries for these verses.',
  patristic: 'Patristic',
  matrixLabel: 'Who comments on each verse',

  // Aplicação
  applicationHint: 'Application comes only from the AI and is always marked as inference.',
};
