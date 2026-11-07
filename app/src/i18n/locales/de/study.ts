// Alemão de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';

export const deStudy = {
  sheet: 'Studium der ausgewählten Textstelle',
  expand: 'Studium erweitern',
  collapse: 'Studium verkleinern',
  close: 'Auswahl aufheben',
  verse: 'Vers',
  verses: 'Verse',
  crosses: (a: string, b: string) => `reicht über ${a} → ${b}`,
  pericope: (r: string) => `Perikope ${r}`,
  pericopeWhole: 'Ganze Perikope',
  pericopeExpanded: (r: string) => `Auswahl auf die Perikope ${r} erweitert`,
  railLabel: 'Perspektiven des Studiums',

  factComentaristas: 'Kommentatoren',
  factVariante: (slash: string) => `Variante ${slash}`,
  factVariantes: (slash: string) => `Varianten ${slash}`,
  factXrefs: 'Querverw.',
  factHapax: (t: Testament) => `Hapax · ${testamentLabel(t, 'de')}`,
  /** Contagem de versículos no testamento da palavra; 1 vira "versículo", o resto "vv.". */
  factVv: (n: number, t: Testament) => `${n} ${n === 1 ? 'Vers' : 'Verse'} · ${testamentLabel(t, 'de')}`,
  factNoData: 'Keine Daten',

  deepen: 'Vertiefen',
  seeAll: 'Alle ansehen',
  seeLess: 'Weniger',
  deepened: 'Vertieft',
  deepenPoint: 'Diesen Punkt vertiefen',
  whereFrom: 'Woher stammt das?',
  askAbout: 'Dazu fragen',
  openPreview: 'Vorschau öffnen',

  summaryOfUnit: 'Zusammenfassung der Perikope',
  summaryContains: 'die die Auswahl enthält',
  noSummary: 'Keine Zusammenfassung für diesen Abschnitt.',
  thinking: 'denkt nach…',
  noProvider:
    'Keine KI-Methode verfügbar. Melde dich mit ChatGPT an oder füge in den Einstellungen einen API-Schlüssel hinzu, um die Zusammenfassung pro Perspektive zu sehen.',
  configure: 'KI einrichten',
  summaryError: (m: string) => `Die Zusammenfassung konnte nicht erstellt werden: ${m}`,
  retry: 'Erneut versuchen',
  panelError: 'Die Quellen zu dieser Textstelle konnten nicht geladen werden.',
  loadingSources: 'Quellen werden geladen…',

  lensCount: {
    visao: 'KI · zitiert die Quellen unten',
    aplicacao: 'keine eigene Quelle',
  },

  // Visão geral (o fio)
  threadTitle: 'Der Faden dieser Textstelle',
  stepsCount: (n: number) => `${n} ${n === 1 ? 'Schritt' : 'Schritte'}`,
  andMore: (n: number) => `und ${n} weitere`,

  // Texto
  translations: 'Übersetzungen und Urtext',
  cmpBlivre: 'Bíblia Livre',
  cmpKjv: 'KJV',
  cmpOriginal: 'Original',
  originalHint: (nt: string, at: string) =>
    `Original: ${nt} für das NT, ${at} für das AT. Tippe auf ein Wort, um seine Morphologie zu sehen.`,
  variantsTitle: 'Varianten zwischen Ausgaben',
  variantsEmpty: (list: string) => `In diesen Versen gibt es keine Unterschiede zwischen ${list}.`,
  variantType: 'Variante',
  omits: 'lässt aus',
  analyzeWord: 'Wort analysieren',
  ask: 'Fragen',

  // Literário
  neighborhood: 'Umfeld',
  include: 'einschließen',
  divisions: 'Textgliederung',
  division: 'Gliederung',
  paragraphStart: 'Absatzbeginn',
  heading: 'Überschrift',
  bookIntro: 'Einleitung zum Buch',
  readEntry: 'Eintrag lesen',
  entry: 'Eintrag',
  topicIndex: 'Themenregister',

  // Histórico
  place: 'Ort',
  places: 'Orte',
  peopleGroups: 'Personen und Gruppen',
  dictionaries: 'Wörterbücher und Enzyklopädien',
  seeEntity: 'Entität ansehen',
  otherPassages: 'Weitere Textstellen',
  otherPassagesSoon: 'Die Liste der Textstellen, die diese Entität erwähnen, kommt bald.',
  entityType: { person: 'Person', place: 'Ort', event: 'Ereignis', group: 'Gruppe', other: 'Entität' } as Record<string, string>,
  historicalEmpty: 'Keine Orte, Personen oder Einträge mit diesen Versen verknüpft.',
  timeline: 'Zeitleiste',
  timelineHere: 'in dieser Textstelle',
  timelineOpen: 'In der Zeitleiste öffnen',

  // Língua
  word: 'Wort',
  hapax: 'Hapax',
  commentMentions: (n: number) => `in ${n} ${n === 1 ? 'Kommentar' : 'Kommentaren'} zitiert`,
  lexiconConcordance: 'Lexikon und Konkordanz',
  languageEmpty: 'Keine Wörter des Urtextes für diese Verse.',
  inText: 'im Text',

  // Intertexto
  xrefType: 'Verw.',
  from: 'aus',
  pinSideBySide: 'Nebeneinander anheften',
  pinned: (r: string) => `${r} oberhalb des Textes angeheftet`,
  topics: 'Themenregister',
  xrefsEmpty: 'Keine Querverweise zu diesen Versen.',
  relevance: 'Relevanz',

  // Interpretação
  whoComments: 'Wer welchen Vers kommentiert',
  allTraditions: 'Alle',
  commentary: 'Kommentar',
  readFull: 'Vollständig lesen',
  moreByAuthor: 'Mehr von diesem Autor',
  onlyAuthor: (a: string) => `Nur ${a}`,
  clearAuthor: 'Alle Autoren',
  commentsEmpty: 'Keine Kommentare zu diesen Versen.',
  patristic: 'Patristik',
  matrixLabel: 'Wer welchen Vers kommentiert',

  // Aplicação
  applicationHint: 'Die Anwendung stammt nur von der KI und ist immer als Schlussfolgerung gekennzeichnet.',
};
