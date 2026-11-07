// Chinês simplificado de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';

export const zhStudy = {
  sheet: '所选经文的研读',
  expand: '展开研读',
  collapse: '收起研读',
  close: '清除选择',
  verseCount: (n: number) => `${n} 节`,
  versesAbbr: (n: number) => `${n} 节`,
  crosses: (a: string, b: string) => `跨越 ${a} → ${b}`,
  pericope: (r: string) => `经文段落 ${r}`,
  pericopeWhole: '整个经文段落',
  pericopeExpanded: (r: string) => `已将选择扩展到经文段落 ${r}`,
  railLabel: '研读视角',

  factComentaristas: '注释者',
  factVariantes: (n: number, slash: string) => `异文 ${slash}`,
  variantCount: (n: number) => `${n} 异文`,
  factXrefs: '交叉引用',
  factHapax: (t: Testament) => `${testamentLabel(t, 'zh')}中的罕用词`,
  /** Contagem de versículos no testamento da palavra. */
  factVv: (n: number, t: Testament) => `${testamentLabel(t, 'zh')}中 ${n} 节`,
  factNoData: '无数据',

  deepen: '详细',
  seeAll: '查看全部',
  seeLess: '收起',
  deepened: '已详细展开',
  deepenPoint: '详细说明此点',
  whereFrom: '这从何而来？',
  askAbout: '就此提问',
  openPreview: '打开预览',

  summaryOfUnit: '经文段落概要',
  summaryContains: '包含所选内容',
  noSummary: '此部分没有概要。',
  thinking: '思考中…',
  noProvider: '没有可用的 AI 方式。请使用 ChatGPT 登录，或在设置中添加 API 密钥，以查看按视角划分的概要。',
  configure: '设置 AI',
  summaryError: (m: string) => `无法生成概要：${m}`,
  retry: '重试',
  panelError: '无法加载此段经文的来源。',
  loadingSources: '正在加载来源…',

  lensCount: {
    visao: 'AI · 引用下列来源',
    aplicacao: '无独立来源',
  },

  // Visão geral (o fio)
  threadTitle: '本段经文的脉络',
  stepsCount: (n: number) => `${n} 个步骤`,
  andMore: (n: number) => `另外 ${n} 项`,

  // Texto
  translations: '译文与原文',
  cmpBlivre: 'Bíblia Livre',
  cmpKjv: 'KJV',
  cmpOriginal: '原文',
  originalHint: (nt: string, at: string) => `原文：新约为 ${nt}，旧约为 ${at}。点按一个词即可查看词法。`,
  variantsTitle: '版本之间的异文',
  variantsEmpty: (list: string) => `这些经文在 ${list} 之间没有差异。`,
  variantType: '异文',
  omits: '省略',
  analyzeWord: '分析词语',
  ask: '提问',

  // Literário
  neighborhood: '上下文',
  include: '包含',
  divisions: '经文划分',
  division: '划分',
  paragraphStart: '段落开始',
  heading: '标题',
  bookIntro: '卷首导言',
  readEntry: '阅读词条',
  entry: '词条',
  topicIndex: '主题索引',

  // Histórico
  place: '地点',
  placesHeading: (_n: number) => '地点',
  placesAndEntries: (places: number, entries: number) => `${places} 个地点 · ${entries} 条词条`,
  peopleGroups: '人物与群体',
  dictionaries: '辞典与百科全书',
  seeEntity: '查看实体',
  otherPassages: '其他经文',
  otherPassagesSoon: '引用此实体的经文列表即将推出。',
  entityType: { person: '人物', place: '地点', event: '事件', group: '群体', other: '实体' } as Record<string, string>,
  historicalEmpty: '没有与这些经节相关的地点、人物或词条。',
  timeline: '时间线',
  timelineHere: '本段经文',
  timelineOpen: '在时间线中打开',

  // Língua
  word: '词',
  hapax: '罕用词',
  commentMentions: (n: number) => `被 ${n} 部注释引用`,
  lexiconConcordance: '词典与经文汇编',
  languageEmpty: '这些经节没有原文词语。',
  inText: '文本中',

  // Intertexto
  xrefType: '参见',
  from: '自',
  pinSideBySide: '并排固定',
  pinned: (r: string) => `${r} 已固定在经文上方`,
  topics: '主题索引',
  xrefsEmpty: '这些经节没有交叉引用。',
  relevance: '相关度',

  // Interpretação
  whoComments: '各节经文由谁注释',
  allTraditions: '全部',
  commentary: '注释',
  readFull: '阅读全文',
  moreByAuthor: '该作者的更多内容',
  onlyAuthor: (a: string) => `仅${a}`,
  clearAuthor: '所有作者',
  commentsEmpty: '这些经节没有注释。',
  patristic: '教父学',
  matrixLabel: '各节经文由谁注释',

  // Aplicação
  applicationHint: '应用部分仅由 AI 生成，并始终标注为推断。',
};
