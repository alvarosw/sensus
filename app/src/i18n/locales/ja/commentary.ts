// Japonês de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
export const jaCommentary = {
  rowTitle: '解釈と注解',
  title: '解釈と注解',
  help: '学びに表示する伝統を選んでください。レンズ、注解、AI が使う内容が対象です。それ以外はアプリ全体で非表示になります。',
  allTraditions: 'すべての伝統',
  secTraditions: '伝統',
  secSources: '注解の出典',
  sourcesHelp: '伝統を受け入れていても、個々の出典は非表示にできます。',
  noSources: 'このデータベースには注解がありません。',
  hiddenNotice: '設定により、他の伝統の注解は非表示になっています',
  adjust: '調整',
  // Resumo da preferência (linha de Configurações). Os rótulos das tradições vêm do núcleo (traditionLabel).
  onlyTradition: (a: string) => `${a}のみ`,
  twoTraditions: (a: string, b: string) => `${a}と${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a}、${b} ほか ${more}`,
  hiddenSources: (n: number) => `非表示の出典 ${n} 件`,
};
