// Tabela de textos da interface. Somente pt-BR por enquanto; toda string de UI
// passa por t(). Para outro idioma, criar outra tabela com as mesmas chaves.

/** Locale de exibição (formatação de datas, etc.). */
export const APP_LOCALE = 'pt-BR';

/** Código de idioma usado como destino em links de tradução (Google Translate). */
export const APP_LANG = 'pt';

const pt = {
  'app.name': 'Sensus',

  'common.loading': 'Carregando…',
  'common.error': 'Algo deu errado.',
  'common.retry': 'Tentar novamente',
  'common.unavailable': 'Conteúdo indisponível para esta fonte.',
  'common.noSource': 'Fonte não encontrada.',
  'common.close': 'Fechar',
  'study.overview': 'Visão geral',
  'study.questionsTitle': 'Perguntas',
  'study.askPlaceholder': 'Faça uma pergunta sobre o trecho…',
  'study.followUps': 'Perguntas de seguimento',
  'study.sources': 'Fontes desta camada',
  'study.passage': 'Trecho',
  'study.showGreek': 'Grego (TR)',
  'study.sectionEmpty': 'Sem resumo para esta seção.',
  'study.hideSources': 'Ocultar fontes',
  'study.viewSources': 'Ver fontes',
  'study.deepen': 'Aprofundar',
  'common.showAll': 'Mostrar todos ({count})',
  'rich.morphConflict': 'Análise gramatical diverge do token citado (esperado: {expected}).',
  'rich.morphTerm': 'Termo usado pela IA: {term}',
  'sheet.openFull': 'Abrir fonte completa',
  'sheet.morph': 'Morfologia',
  'sheet.lexicon': 'Léxico (resumo)',
  'common.none': 'Nenhum item.',

  'db.loading': 'Preparando o banco de dados…',
  'db.error': 'Não foi possível abrir o banco de dados.',

  'books.ot': 'Antigo Testamento',
  'books.nt': 'Novo Testamento',
  'books.chapters': '{count} capítulos',

  'reader.title': 'Leitura',
  'reader.textSource': 'Texto',
  'reader.hint': 'Toque em um versículo para selecionar. Toque em outro para estender o intervalo.',
  'reader.noVerses': 'Este capítulo não tem texto nesta fonte.',
  'reader.clear': 'Limpar',
  'reader.study': 'Estudar {reference}',

  'study.title': 'Estudo',
  'study.summaryTitle': 'Resumo hermenêutico',
  'study.summaryHint': 'Gerado por IA apenas a partir do material abaixo. Confira as citações.',
  'study.generate': 'Gerar resumo',
  'study.regenerate': 'Gerar novamente',
  'study.stop': 'Parar',
  'study.generating': 'Gerando resumo…',
  'study.noProvider': 'Nenhum provedor de IA configurado. Adicione sua chave de API nas configurações.',
  'study.configure': 'Configurar IA',
  'study.summaryError': 'Não foi possível gerar o resumo: {message}',
  'study.uncited': 'sem citação',
  'study.invalidCite': 'citação inválida',
  'study.inference': 'Inferência',
  'study.panelLoading': 'Montando o painel…',
  'study.panelError': 'Não foi possível montar o painel deste trecho.',
  'study.chatTitle': 'Perguntas',
  'study.chatEmpty': 'Faça uma pergunta sobre este trecho. A conversa fica só nesta tela.',
  'study.chatPlaceholder': 'Pergunte sobre o texto…',
  'study.chatSend': 'Enviar',
  'study.chatYou': 'Você',
  'study.chatAi': 'Sensus',
  'study.chatError': 'Falha na resposta: {message}',

  'cite.txt': 'Texto',
  'cite.tok': 'Palavra',
  'cite.lex': 'Léxico',
  'cite.com': 'Comentário',
  'cite.dic': 'Dicionário',
  'cite.xr': 'Referência',
  'cite.ent': 'Entidade',
  'cite.src': 'Fonte',

  'section.text': 'Texto',
  'section.literary': 'Contexto literário',
  'section.historical': 'Contexto histórico',
  'section.language': 'Língua original',
  'section.intertext': 'Intertextualidade',
  'section.interpretation': 'História da interpretação',

  'text.translations': 'Traduções',
  'text.original': 'Texto original',
  'text.variants': 'Variantes entre edições',
  'text.editions': 'Edições: {editions}',

  'lit.before': 'Antes',
  'lit.after': 'Depois',
  'lit.divisions': 'Divisões do texto',
  'lit.paragraph': 'Parágrafo',
  'lit.heading': 'Título de seção',
  'lit.intro': 'Introdução ao livro',

  'hist.entities': 'Pessoas, lugares e eventos',
  'hist.dictionary': 'Verbetes de dicionário',
  'entity.person': 'Pessoa',
  'entity.place': 'Lugar',
  'entity.event': 'Evento',
  'entity.group': 'Grupo',
  'entity.other': 'Outro',

  'lang.lexicon': 'Léxico',
  'lang.concordance': 'Concordância',
  'lang.occurrences': '{count} ocorrências',

  'inter.xrefs': 'Referências cruzadas',
  'inter.topics': 'Índices temáticos',
  'inter.weight': 'relevância {weight}',

  'interp.commentaries': 'Comentários',

  'source.title': 'Fonte',
  'source.record': 'Registro',
  'source.details': 'Detalhes da fonte',
  'source.reference': 'Referência',
  'source.translate': 'Traduzir',
  'source.translatePart': 'Traduzir (parte {part} de {total})',
  'source.openUrl': 'Abrir origem',
  'source.notFound': 'Registro não encontrado.',
  'source.field.title': 'Título',
  'source.field.author': 'Autor',
  'source.field.lang': 'Idioma',
  'source.field.license': 'Licença',
  'source.field.attribution': 'Atribuição',
  'source.field.url': 'Origem',
  'source.field.version': 'Versão',
  'source.field.retrieved': 'Obtido em',
  'source.field.tradition': 'Tradição',
  'source.field.notes': 'Notas',
  'source.field.strong': 'Strong',
  'source.field.morph': 'Morfologia',
  'source.field.gloss': 'Glosa',
  'source.field.lemma': 'Lema',
  'source.field.translit': 'Transliteração',
  'source.field.editions': 'Edições',
  'source.field.variant': 'Nota de variante',
  'source.field.altRef': 'Referência alternativa',
  'source.field.weight': 'Relevância',
  'source.field.coords': 'Coordenadas',
  'source.field.type': 'Tipo',

  'settings.title': 'Configurações de IA',
  'settings.provider': 'Provedor',
  'settings.baseUrl': 'URL base',
  'settings.model': 'Modelo',
  'settings.apiKey': 'Chave de API',
  'settings.apiKeyPlaceholder': 'Cole sua chave',
  'settings.apiKeySaved': 'Uma chave está salva neste aparelho. Deixe em branco para mantê-la.',
  'settings.apiKeyDev': 'Sem chave salva: usando a chave de desenvolvimento do .env.',
  'settings.byokHint':
    'Use a sua própria chave. Ela fica guardada de forma segura neste aparelho e é enviada somente ao provedor escolhido.',
  'settings.save': 'Salvar',
  'settings.saved': 'Configurações salvas.',
  'settings.test': 'Testar conexão',
  'settings.testing': 'Testando…',
  'settings.testOk': 'Conexão ok. {count} modelos disponíveis.',
  'settings.pickModel': 'Modelos disponíveis (toque para escolher):',
  'settings.testFail': 'Falha na conexão: {message}',
  'settings.removeKey': 'Remover chave salva',
  'settings.keyRemoved': 'Chave removida deste aparelho.',
  'settings.needKey': 'Informe uma chave de API.',
  'settings.needBaseUrl': 'Informe a URL base do provedor.',
  'settings.needModel': 'Informe o modelo.',
  'settings.saveError': 'Não foi possível salvar: {message}',
  'settings.status': 'Estado atual: {state}',
  'settings.stateReady': 'pronto para gerar resumos',
  'settings.stateMissing': 'sem chave configurada',
} as const;

export type StringKey = keyof typeof pt;

/** Traduz uma chave, substituindo {variaveis}. */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let text: string = pt[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
