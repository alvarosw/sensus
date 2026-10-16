import { describe, expect, it } from 'vitest';
import { timelineCore } from '../src/index';

// Núcleo de uma linha do tempo: pontas isoladas (mais de 50 anos do vizinho e de metade do resto) ficam de fora.

describe('timelineCore', () => {
  it('tira a ponta isolada (Jesus na criação) e mantém o restante', () => {
    expect(timelineCore([-4003, 26, 27, 28, 30])).toEqual({ lo: 26, hi: 30, far: [-4003] });
  });

  it('tira a ponta isolada do lado de cá (Moisés na transfiguração)', () => {
    expect(timelineCore([-1569, -1489, -1450, 29])).toEqual({ lo: -1569, hi: -1450, far: [29] });
  });

  it('não tira pontas com intervalos pequenos (até 50 anos)', () => {
    expect(timelineCore([10, 20, 30])).toEqual({ lo: 10, hi: 30, far: [] });
    expect(timelineCore([0, 50, 100])).toEqual({ lo: 0, hi: 100, far: [] });
  });

  it('não tira quando o intervalo não passa da metade do resto', () => {
    // Intervalo de 100 anos, mas o resto da linha tem 300: a ponta fica.
    expect(timelineCore([0, 100, 200, 300, 400])).toEqual({ lo: 0, hi: 400, far: [] });
  });

  it('com dois ou menos eventos não tira nada; linha vazia tem extensão zero', () => {
    expect(timelineCore([-4003, 30])).toEqual({ lo: -4003, hi: 30, far: [] });
    expect(timelineCore([5])).toEqual({ lo: 5, hi: 5, far: [] });
    expect(timelineCore([])).toEqual({ lo: 0, hi: 0, far: [] });
  });

  it('não depende da ordem de entrada', () => {
    expect(timelineCore([30, -4003, 28, 27, 26])).toEqual({ lo: 26, hi: 30, far: [-4003] });
  });
});
