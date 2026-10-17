import { beforeEach, describe, expect, it } from 'vitest';
import { useStudy } from './index';

const INITIAL = useStudy.getState();
beforeEach(() => useStudy.setState(INITIAL, true));

describe('lentes: goToLens e consumeLensTarget', () => {
  it('a partir de fechada, vai para a lente, marca o alvo e abre em meia altura', () => {
    useStudy.getState().goToLens('lingua');
    const s = useStudy.getState();
    expect(s.lens).toBe('lingua');
    expect(s.lensTarget).toBe('lingua');
    expect(s.detent).toBe('half');
  });

  it('a partir de peek, abre em meia altura', () => {
    useStudy.setState({ detent: 'peek' });
    useStudy.getState().goToLens('texto');
    expect(useStudy.getState().detent).toBe('half');
  });

  it('não reduz uma folha já aberta em tela cheia', () => {
    useStudy.setState({ detent: 'full' });
    useStudy.getState().goToLens('interpretacao');
    expect(useStudy.getState().detent).toBe('full');
  });

  it('consumeLensTarget zera só o alvo e mantém a lente visível', () => {
    useStudy.getState().goToLens('historico');
    useStudy.getState().consumeLensTarget();
    expect(useStudy.getState().lensTarget).toBeNull();
    expect(useStudy.getState().lens).toBe('historico');
  });

  it('setLens não mexe no alvo de rolagem', () => {
    useStudy.getState().goToLens('texto');
    useStudy.getState().setLens('aplicacao');
    expect(useStudy.getState().lensTarget).toBe('texto');
    expect(useStudy.getState().lens).toBe('aplicacao');
  });
});

describe('lentes: "ver todos" e tradição', () => {
  it('toggleExpanded liga e desliga uma chave sem tocar nas outras', () => {
    useStudy.getState().toggleExpanded('lingua');
    useStudy.getState().toggleExpanded('texto-cmp');
    expect(useStudy.getState().expanded).toEqual({ lingua: true, 'texto-cmp': true });
    useStudy.getState().toggleExpanded('lingua');
    expect(useStudy.getState().expanded).toEqual({ lingua: false, 'texto-cmp': true });
  });

  it('setTradition aceita um filtro e volta a null', () => {
    useStudy.getState().setTradition('reformed');
    expect(useStudy.getState().tradition).toBe('reformed');
    useStudy.getState().setTradition(null);
    expect(useStudy.getState().tradition).toBeNull();
  });
});
