// Japonês de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';

export const jaStudy = {
  sheet: '選択した箇所の学び',
  expand: '学びを展開',
  collapse: '学びを折りたたむ',
  close: '選択を解除',
  verseCount: (n: number) => `${n} 節`,
  versesAbbr: (n: number) => `${n} 節`,
  crosses: (a: string, b: string) => `${a} → ${b} にまたがる`,
  pericope: (r: string) => `ペリコペ ${r}`,
  pericopeWhole: 'ペリコペ全体',
  pericopeExpanded: (r: string) => `選択範囲をペリコペ ${r} まで広げました`,
  railLabel: '学びのレンズ',

  factComentaristas: '注解者',
  factVariantes: (n: number, slash: string) => `異読 ${slash}`,
  variantCount: (n: number) => `${n} 異読`,
  factXrefs: '相互参照',
  factHapax: (t: Testament) => `${testamentLabel(t, 'ja')}のハパックス`,
  /** Contagem de versículos no testamento da palavra. */
  factVv: (n: number, t: Testament) => `${testamentLabel(t, 'ja')}で ${n} 節`,
  factNoData: 'データなし',

  deepen: '詳しく',
  seeAll: 'すべて見る',
  seeLess: '減らす',
  deepened: '詳細表示中',
  deepenPoint: 'この項目を詳しく見る',
  whereFrom: 'これはどこから来ているのか？',
  askAbout: 'これについて質問',
  openPreview: 'プレビューを開く',

  summaryOfUnit: 'ペリコペの要約',
  summaryContains: '選択範囲を含む',
  noSummary: 'このセクションの要約はありません。',
  thinking: '考え中…',
  noProvider:
    'AI の方法が利用できません。ChatGPT でサインインするか、設定で API キーを追加すると、レンズごとの要約を表示できます。',
  configure: 'AI を設定',
  summaryError: (m: string) => `要約を作成できませんでした: ${m}`,
  retry: '再試行',
  panelError: 'この箇所の資料を読み込めませんでした。',
  loadingSources: '資料を読み込み中…',

  lensCount: {
    visao: 'AI · 下の資料を引用',
    aplicacao: '独自の資料なし',
  },

  // Visão geral (o fio)
  threadTitle: 'この箇所の流れ',
  stepsCount: (n: number) => `${n} ステップ`,
  andMore: (n: number) => `ほか ${n} 件`,

  // Texto
  translations: '訳と原語',
  cmpBlivre: 'Bíblia Livre',
  cmpKjv: 'KJV',
  cmpOriginal: '原語',
  originalHint: (nt: string, at: string) =>
    `原語: 新約は ${nt}、旧約は ${at}。語をタップすると形態を表示します。`,
  variantsTitle: '版の間の異読',
  variantsEmpty: (list: string) => `これらの節には ${list} の間の違いはありません。`,
  variantType: '異読',
  omits: '省略',
  analyzeWord: '語を分析',
  ask: '質問',

  // Literário
  neighborhood: '前後の文脈',
  include: '含める',
  divisions: '本文の区分',
  division: '区分',
  paragraphStart: '段落の始まり',
  heading: '見出し',
  bookIntro: '書の序論',
  readEntry: '項目を読む',
  entry: '項目',
  topicIndex: '主題索引',

  // Histórico
  place: '地名',
  placesHeading: (_n: number) => '地名',
  placesAndEntries: (places: number, entries: number) => `${places} 地名 · ${entries} 項目`,
  peopleGroups: '人物と集団',
  dictionaries: '辞典と事典',
  seeEntity: '実体を見る',
  otherPassages: '他の箇所',
  otherPassagesSoon: 'この実体を引用する箇所の一覧は近日公開予定です。',
  entityType: { person: '人物', place: '地名', event: '出来事', group: '集団', other: '実体' } as Record<string, string>,
  historicalEmpty: 'これらの節に関連する地名、人物、項目はありません。',
  timeline: '年表',
  timelineHere: 'この箇所',
  timelineOpen: '年表で開く',

  // Língua
  word: '語',
  hapax: 'ハパックス',
  commentMentions: (n: number) => `${n} 件の注解で引用`,
  lexiconConcordance: '辞典とコンコーダンス',
  languageEmpty: 'これらの節には原語の語がありません。',
  inText: '本文中',

  // Intertexto
  xrefType: '参照',
  from: 'から',
  pinSideBySide: '並べて固定',
  pinned: (r: string) => `${r} を本文の上に固定しました`,
  topics: '主題索引',
  xrefsEmpty: 'これらの節の相互参照はありません。',
  relevance: '関連度',

  // Interpretação
  whoComments: '各節の注解者',
  allTraditions: 'すべて',
  commentary: '注解',
  readFull: '全文を読む',
  moreByAuthor: 'この著者の他の注解',
  onlyAuthor: (a: string) => `${a}のみ`,
  clearAuthor: 'すべての著者',
  commentsEmpty: 'これらの節の注解はありません。',
  patristic: '教父学',
  matrixLabel: '各節の注解者',

  // Aplicação
  applicationHint: '応用は AI のみによるもので、常に推論として表示されます。',
  xrefsCount: (n: number) => `${n} 件の参照`,
  commentariesCount: (n: number) => `${n} 件の注解`,
  chapterMark: (n: number) => `（第 ${n} 章）`,
  literaryEmpty: 'この出典には文学的文脈がありません。',
  sheetBackHalf: '半分の高さに戻す',
  sheetToggleHeight: '学習パネルの高さを切り替え',
};
