// RASCUNHO (es): ainda é a cópia do inglês; traduzir. Origem: inglês de app/src/settings/commentary-strings.ts (preferência de comentários). A checagem de tipo fica no strings.ts.
export const esCommentary = {
  rowTitle: 'Interpretation and commentaries',
  title: 'Interpretation and commentaries',
  help: 'Choose the traditions you want to see in your study: lenses, commentaries and what the AI uses. The others stay hidden across the app.',
  allTraditions: 'All traditions',
  secTraditions: 'Traditions',
  secSources: 'Commentary sources',
  sourcesHelp: 'Each source can stay hidden even when its tradition is accepted.',
  noSources: 'This database has no commentaries.',
  hiddenNotice: 'Commentaries from other traditions hidden by your preferences',
  adjust: 'Adjust',
  onlyTradition: (a: string) => `${a} only`,
  twoTraditions: (a: string, b: string) => `${a} and ${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a}, ${b} and ${more} more`,
  hiddenSources: (n: number) => (n === 1 ? '1 hidden source' : `${n} hidden sources`),
};
