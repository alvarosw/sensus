// Textos da folha de estudo (pt-BR). Mantidos aqui para não colidir com a tabela global em i18n.
import { testamentLabel, type Testament } from '@sensus/core';

export const STUDY = {
  sheet: 'Estudo do trecho selecionado',
  expand: 'Expandir estudo',
  collapse: 'Reduzir estudo',
  close: 'Limpar seleção',
  verse: 'versículo',
  verses: 'versículos',
  crosses: (a: string, b: string) => `atravessa ${a} → ${b}`,
  pericope: (r: string) => `Perícope ${r}`,
  pericopeWhole: 'Perícope inteira',
  pericopeExpanded: (r: string) => `Seleção expandida para a perícope ${r}`,
  railLabel: 'Lentes do estudo',

  factComentaristas: 'comentaristas',
  factVariante: 'variante TR/NA',
  factVariantes: 'variantes TR/NA',
  factXrefs: 'refs. cruzadas',
  factHapax: (t: Testament) => `hápax no ${testamentLabel(t)}`,
  /** Contagem de versículos no testamento da palavra; 1 vira "versículo", o resto "vv.". */
  factVv: (n: number, t: Testament) => `${n} ${n === 1 ? 'versículo' : 'vv.'} no ${testamentLabel(t)}`,
  factNoData: 'Sem dados',

  deepen: 'Detalhar',
  seeAll: 'Ver todos',
  seeLess: 'Menos',
  deepened: 'Detalhado',
  deepenPoint: 'Detalhar este ponto',
  whereFrom: 'De onde vem isso?',
  askAbout: 'Perguntar sobre isto',
  openPreview: 'Abrir prévia',

  summaryOfUnit: 'Resumo da perícope',
  summaryContains: 'que contém a seleção',
  noSummary: 'Sem resumo para esta seção.',
  thinking: 'pensando…',
  noProvider: 'Nenhum método de IA disponível. Entre com o ChatGPT ou adicione uma chave de API nas configurações para ver o resumo por lente.',
  configure: 'Configurar IA',
  summaryError: (m: string) => `Não foi possível gerar o resumo: ${m}`,
  retry: 'Tentar novamente',
  panelError: 'Não foi possível carregar as fontes deste trecho.',
  loadingSources: 'Carregando fontes…',

  lensCount: {
    visao: 'IA · cita as fontes abaixo',
    aplicacao: 'sem fonte própria',
  },

  // Visão geral (o fio)
  threadTitle: 'O fio deste trecho',
  stepsCount: (n: number) => `${n} ${n === 1 ? 'passo' : 'passos'}`,
  andMore: (n: number) => `e mais ${n}`,

  // Texto
  translations: 'Traduções e original',
  cmpBlivre: 'Bíblia Livre',
  cmpKjv: 'KJV',
  cmpTr: 'Grego TR',
  cmpHint: 'Toque numa palavra para ver morfologia, léxico e concordância.',
  variantsTitle: 'Variantes entre edições',
  variantsEmpty: 'Nenhuma diferença entre TR, BYZ e NA nestes versículos.',
  variantType: 'Variante',
  omits: 'omite',
  analyzeWord: 'Analisar palavra',
  ask: 'Perguntar',

  // Literário
  neighborhood: 'Vizinhança',
  include: 'incluir',
  divisions: 'Divisões do texto',
  division: 'Divisão',
  paragraphStart: 'Início de parágrafo',
  heading: 'Título',
  bookIntro: 'Introdução ao livro',
  readEntry: 'Ler verbete',
  entry: 'Verbete',
  topicIndex: 'Índice temático',

  // Histórico
  place: 'Lugar',
  places: 'Lugares',
  peopleGroups: 'Pessoas e grupos',
  dictionaries: 'Dicionários e enciclopédias',
  seeEntity: 'Ver entidade',
  otherPassages: 'Outras passagens',
  otherPassagesSoon: 'A lista de passagens que citam esta entidade chega em breve.',
  entityType: { person: 'Pessoa', place: 'Lugar', event: 'Evento', group: 'Grupo', other: 'Entidade' } as Record<string, string>,
  historicalEmpty: 'Sem lugares, pessoas ou verbetes ligados a estes versículos.',
  timeline: 'Linha do tempo',
  timelineHere: 'neste trecho',
  timelineOpen: 'Abrir na linha do tempo',

  // Língua
  word: 'Palavra',
  hapax: 'hápax',
  commentMentions: (n: number) => `citada em ${n} comentário${n === 1 ? '' : 's'}`,
  lexiconConcordance: 'Léxico e concordância',
  languageEmpty: 'Sem palavras do texto original para estes versículos.',
  inText: 'no texto',

  // Intertexto
  xrefType: 'Ref.',
  from: 'de',
  pinSideBySide: 'Fixar lado a lado',
  pinned: (r: string) => `${r} fixado acima do texto`,
  topics: 'Índices temáticos',
  xrefsEmpty: 'Sem referências cruzadas para estes versículos.',
  relevance: 'Relevância',

  // Interpretação
  whoComments: 'Quem comenta cada versículo',
  allTraditions: 'Todas',
  commentary: 'Comentário',
  readFull: 'Ler completo',
  moreByAuthor: 'Mais deste autor',
  onlyAuthor: (a: string) => `Só ${a}`,
  clearAuthor: 'Todos os autores',
  commentsEmpty: 'Sem comentários para estes versículos.',
  patristic: 'Patrística',
  matrixLabel: 'Quem comenta cada versículo',

  // Aplicação
  applicationHint: 'A aplicação vem só da IA e é sempre marcada como inferência.',
};
