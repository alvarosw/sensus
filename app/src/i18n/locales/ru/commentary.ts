import { ruPlural } from '../../plural';
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

