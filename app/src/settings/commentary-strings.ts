import { localized } from '../i18n';
import { enCommentary } from '../i18n/locales/en/commentary';
// Textos pt-BR da preferência de comentários: linha de Configurações, tela de tradições e aviso na folha de estudo.
const ptCommentary = {
  rowTitle: 'Interpretação e comentários',
  title: 'Interpretação e comentários',
  help: 'Escolha as tradições que você quer ver no estudo: lentes, comentários e o que a IA usa. As demais ficam ocultas em todo o app.',
  allTraditions: 'Todas as tradições',
  secTraditions: 'Tradições',
  secSources: 'Fontes de comentário',
  sourcesHelp: 'Cada fonte pode ficar oculta mesmo com a sua tradição aceita.',
  noSources: 'Este banco não tem comentários.',
  hiddenNotice: 'Comentários de outras tradições ocultos pelas suas preferências',
  adjust: 'Ajustar',
  // Resumo da preferência (linha de Configurações). Os rótulos das tradições vêm do núcleo (traditionLabel).
  onlyTradition: (a: string) => `Só ${a}`,
  twoTraditions: (a: string, b: string) => `${a.charAt(0).toUpperCase()}${a.slice(1)} e ${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a.charAt(0).toUpperCase()}${a.slice(1)}, ${b} e mais ${more}`,
  hiddenSources: (n: number) => (n === 1 ? '1 fonte oculta' : `${n} fontes ocultas`),
};
export const COMMENTARY_STRINGS = localized<typeof ptCommentary>({ pt: ptCommentary, en: enCommentary });
