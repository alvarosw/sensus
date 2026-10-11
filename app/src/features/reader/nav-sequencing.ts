// Sequenciamento dos pedidos de navegação do leitor ("ir para", livros, capítulos). Puro: sem React nem
// geometria, para ser testado. O leitor decide com isto se só rola ou se carrega a janela de capítulos
// antes, e descarta cargas que já foram superadas por um pedido mais novo.

export interface ChapterWindow {
  lo: number;
  hi: number;
}

/**
 * 'scroll': o capítulo alvo já está na janela, medido e da mesma fonte; basta rolar.
 * 'load': é preciso recarregar a janela em torno do alvo (outro livro/capítulo, fonte diferente ou sem medida).
 */
export type NavAction = 'scroll' | 'load';

export function planNavigation(input: {
  targetIdx: number;
  win: ChapterWindow | null;
  hasChapter: boolean;
  sameSource: boolean;
}): NavAction {
  const { targetIdx, win, hasChapter, sameSource } = input;
  if (win && targetIdx >= win.lo && targetIdx <= win.hi && hasChapter && sameSource) return 'scroll';
  return 'load';
}

/**
 * Controle de cargas concorrentes: cada `begin()` devolve um token; só o último token ainda é `current()`.
 * Uma carga que termina depois de outra começada deve ser descartada (não sobrescreve a janela nova).
 */
export function createLoadSequencer() {
  let latest = 0;
  return {
    begin(): number {
      return ++latest;
    },
    isCurrent(token: number): boolean {
      return token === latest;
    },
  };
}

/**
 * Rolagem automática da seleção (manter visível acima da folha) só pode agir com o leitor estável:
 * nada em andamento (arraste, navegação pendente ou carregando), e fora da janela de assentamento.
 */
export function mayAutoScroll(state: { dragging: boolean; navPending: boolean; loadingNav: boolean; sinceNavMs: number; settleMs?: number }): boolean {
  const settle = state.settleMs ?? 500;
  return !state.dragging && !state.navPending && !state.loadingNav && state.sinceNavMs >= settle;
}
