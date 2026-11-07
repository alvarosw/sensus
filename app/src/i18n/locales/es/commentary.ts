// Espanhol de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
export const esCommentary = {
  rowTitle: 'Interpretación y comentarios',
  title: 'Interpretación y comentarios',
  help: 'Elige las tradiciones que quieres ver en tu estudio: lentes, comentarios y lo que usa la IA. Las demás quedan ocultas en toda la app.',
  allTraditions: 'Todas las tradiciones',
  secTraditions: 'Tradiciones',
  secSources: 'Fuentes de comentario',
  sourcesHelp: 'Cada fuente puede quedar oculta aunque su tradición esté aceptada.',
  noSources: 'Esta base de datos no tiene comentarios.',
  hiddenNotice: 'Comentarios de otras tradiciones ocultos por tus preferencias',
  adjust: 'Ajustar',
  onlyTradition: (a: string) => `Solo ${a}`,
  twoTraditions: (a: string, b: string) => `${a.charAt(0).toUpperCase()}${a.slice(1)} y ${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a.charAt(0).toUpperCase()}${a.slice(1)}, ${b} y ${more} más`,
  hiddenSources: (n: number) => (n === 1 ? '1 fuente oculta' : `${n} fuentes ocultas`),
};
