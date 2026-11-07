// Russo de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
export const ruCommentary = {
  rowTitle: 'Толкование и комментарии',
  title: 'Толкование и комментарии',
  help: 'Выберите традиции, которые хотите видеть в изучении: линзы, комментарии и то, что использует ИИ. Остальные скрыты во всём приложении.',
  allTraditions: 'Все традиции',
  secTraditions: 'Традиции',
  secSources: 'Источники комментариев',
  sourcesHelp: 'Каждый источник можно скрыть, даже если его традиция принята.',
  noSources: 'В этой базе нет комментариев.',
  hiddenNotice: 'Комментарии других традиций скрыты вашими настройками',
  adjust: 'Настроить',
  // Resumo da preferência (linha de Configurações). Os rótulos das tradições vêm do núcleo (traditionLabel).
  onlyTradition: (a: string) => `Только ${a}`,
  twoTraditions: (a: string, b: string) => `${a.charAt(0).toUpperCase()}${a.slice(1)} и ${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a.charAt(0).toUpperCase()}${a.slice(1)}, ${b} и ещё ${more}`,
  hiddenSources: (n: number) => `${n} ${ruPlural(n, 'скрытый источник', 'скрытых источника', 'скрытых источников')}`,
};

// Plural russo: 1 / 2-4 / 5+ (os números 11 a 14 seguem a terceira forma).
const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
