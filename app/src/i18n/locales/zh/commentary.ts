// Chinês simplificado de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
export const zhCommentary = {
  rowTitle: '解释与注释',
  title: '解释与注释',
  help: '选择你想在研读中看到的传统：视角、注释以及 AI 所用的内容。其余传统在整个应用中隐藏。',
  allTraditions: '所有传统',
  secTraditions: '传统',
  secSources: '注释来源',
  sourcesHelp: '即使某个传统已被接受，其中的每个来源仍可单独隐藏。',
  noSources: '此数据库没有注释。',
  hiddenNotice: '因你的偏好，其他传统的注释已隐藏',
  adjust: '调整',
  // Resumo da preferência (linha de Configurações). Os rótulos das tradições vêm do núcleo (traditionLabel).
  onlyTradition: (a: string) => `仅${a}`,
  twoTraditions: (a: string, b: string) => `${a}和${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a}、${b}和另外 ${more} 个`,
  hiddenSources: (n: number) => `已隐藏 ${n} 个来源`,
};
