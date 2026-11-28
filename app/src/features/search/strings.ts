import { localized } from '../../i18n';
import { searchTables } from '../../i18n/locales/all';
// Textos (pt-BR) da busca por palavra: o campo do "Ir para", a tela de resultados e a pílula de navegação.
// `bible` = sigla da Bíblia ativa; `shown` = número já formatado no idioma do app.

const ptSearch = {
  placeholder: 'Referência ou palavra',
  goTo: (ref: string) => `Ir para ${ref}`,
  searchFor: (q: string, bible: string) => `Buscar “${q}” na ${bible}`,
  enterHint: 'Enter faz a primeira opção.',
  recent: 'Buscas recentes',
  back: 'Voltar ao leitor',
  wordPlaceholder: 'Palavra',
  clear: 'Limpar',
  allBible: 'Toda a Bíblia',
  ot: 'AT',
  nt: 'NT',
  book: 'Livro',
  allBooks: 'Todos os livros',
  booksWithHits: 'Livros com resultados',
  oldTestament: 'Antigo Testamento',
  newTestament: 'Novo Testamento',
  summary: (n: number, shown: string, books: number) => `${shown} ${n === 1 ? 'versículo' : 'versículos'} em ${books} ${books === 1 ? 'livro' : 'livros'}`,
  summaryIn: (n: number, shown: string, book: string) => `${shown} ${n === 1 ? 'versículo' : 'versículos'} em ${book}`,
  ruleWord: (bible: string) => `Palavra inteira, sem diferenciar acentos · ${bible}`,
  rulePrefix: (q: string, bible: string) => `Palavras que começam com “${q}”, sem diferenciar acentos · ${bible}`,
  prefixOffer: (n: number, q: string) => `Mais ${n} com palavras que começam com “${q}”.`,
  include: 'Incluir',
  prefixOn: (q: string) => `Incluindo palavras que começam com “${q}”.`,
  onlyWord: 'Só a palavra',
  moreIn: (n: number, book: string) => `Mais ${n} em ${book}`,
  end: 'Fim dos resultados',
  preparingTitle: (bible: string) => `Preparando a busca na ${bible}`,
  preparingLabel: 'Organizando os versículos',
  preparingBody: 'Só na primeira vez em cada Bíblia, leva alguns segundos. Pode voltar a ler: avisamos quando estiver pronta.',
  ready: (bible: string) => `Busca pronta na ${bible}`,
  seeResults: 'Ver resultados',
  noneTitle: (q: string) => `Nenhum versículo com “${q}”`,
  noneBody: (bible: string) => `Nada na ${bible}. Confira a grafia ou tente outra forma da palavra.`,
  noneFiltered: 'Os filtros escondem os resultados.',
  searchAll: (n: number) => `Buscar em toda a Bíblia (${n})`,
  unavailable: 'A busca precisa de uma Bíblia baixada.',
  failed: 'Não foi possível preparar a busca.',
  retry: 'Tentar de novo',
  navLabel: (i: number, n: number, q: string) => `${i} de ${n} · “${q}”`,
  prev: 'Resultado anterior',
  next: 'Próximo resultado',
  list: 'Lista',
  closeNav: 'Fechar a busca',
};

export type SearchStrings = typeof ptSearch;
export const SEARCH = localized<SearchStrings>({ pt: ptSearch, ...searchTables });
