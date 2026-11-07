// Alemão de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
export const deCommentary = {
  rowTitle: 'Auslegung und Kommentare',
  title: 'Auslegung und Kommentare',
  help: 'Wähle die Traditionen, die du in deinem Studium sehen möchtest: Perspektiven, Kommentare und was die KI verwendet. Die übrigen bleiben in der ganzen App ausgeblendet.',
  allTraditions: 'Alle Traditionen',
  secTraditions: 'Traditionen',
  secSources: 'Kommentarquellen',
  sourcesHelp: 'Jede Quelle kann ausgeblendet bleiben, auch wenn ihre Tradition akzeptiert ist.',
  noSources: 'Diese Datenbank enthält keine Kommentare.',
  hiddenNotice: 'Kommentare anderer Traditionen durch deine Einstellungen ausgeblendet',
  adjust: 'Anpassen',
  onlyTradition: (a: string) => `Nur ${a}`,
  twoTraditions: (a: string, b: string) => `${a} und ${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a}, ${b} und ${more} weitere`,
  hiddenSources: (n: number) => (n === 1 ? '1 Quelle ausgeblendet' : `${n} Quellen ausgeblendet`),
};
