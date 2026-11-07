// Français de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
export const frCommentary = {
  rowTitle: 'Interprétation et commentaires',
  title: 'Interprétation et commentaires',
  help: 'Choisissez les traditions que vous voulez voir dans votre étude : lentilles, commentaires et ce qu’utilise l’IA. Les autres restent masquées dans toute l’application.',
  allTraditions: 'Toutes les traditions',
  secTraditions: 'Traditions',
  secSources: 'Sources de commentaires',
  sourcesHelp: 'Chaque source peut rester masquée même si sa tradition est acceptée.',
  noSources: 'Cette base de données ne contient pas de commentaires.',
  hiddenNotice: 'Commentaires d’autres traditions masqués par vos préférences',
  adjust: 'Ajuster',
  onlyTradition: (a: string) => `Seulement ${a}`,
  twoTraditions: (a: string, b: string) => `${a.charAt(0).toUpperCase()}${a.slice(1)} et ${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a.charAt(0).toUpperCase()}${a.slice(1)}, ${b} et ${more} de plus`,
  hiddenSources: (n: number) => (n === 1 ? '1 source masquée' : `${n} sources masquées`),
};
