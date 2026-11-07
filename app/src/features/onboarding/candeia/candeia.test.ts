// Regras puras da candeia: trechos das linhas, caminho automático, física de carregar e tremulação da chama.
// Casos em escrita da esquerda para a direita (português), da direita para a esquerda (árabe) e sem espaços
// (chinês).
import { describe, expect, it } from 'vitest';
import { flicker, fbm1, noise1 } from './noise';
import { charWeight, litBy, pathDuration, planPath, samplePath, segmentLines, type TextLine } from './path';
import { restingSim, stepLamp, type LampSim } from './physics';

const PT: TextLine[] = [
  { x: 12, y: 0, width: 300, height: 40, text: 'Tua palavra é lâmpada ' },
  { x: 20, y: 40, width: 284, height: 40, text: 'para meus pés e luz para ' },
  { x: 70, y: 80, width: 184, height: 40, text: 'meu caminho.' },
];
const AR: TextLine[] = [
  { x: 30, y: 0, width: 260, height: 44, text: 'سراج لرجلي كلامك ' },
  { x: 90, y: 44, width: 140, height: 44, text: 'ونور لسبيلي.' },
];
const ZH: TextLine[] = [{ x: 10, y: 0, width: 300, height: 40, text: '你的话是我脚前的灯，是我路上' }];

describe('segmentLines', () => {
  it('um trecho por palavra, cobrindo a linha sem buracos', () => {
    const segs = segmentLines(PT);
    expect(segs.filter((s) => s.line === 0)).toHaveLength(4);
    expect(segs.filter((s) => s.line === 2)).toHaveLength(2);
    const l0 = segs.filter((s) => s.line === 0);
    for (let i = 1; i < l0.length; i++) expect(l0[i]!.x0).toBeCloseTo(l0[i - 1]!.x1);
    expect(l0[0]!.x0).toBeLessThan(PT[0]!.x);
    expect(l0[l0.length - 1]!.x1).toBeGreaterThan(PT[0]!.x + PT[0]!.width);
    expect(l0[0]!.cy).toBe(20);
  });

  it('em rtl a primeira palavra fica à direita', () => {
    const segs = segmentLines(AR, true).filter((s) => s.line === 0);
    expect(segs).toHaveLength(3);
    expect(segs[0]!.cx).toBeGreaterThan(segs[1]!.cx);
    expect(segs[1]!.cx).toBeGreaterThan(segs[2]!.cx);
    expect(segs[0]!.x1).toBeGreaterThan(AR[0]!.x + AR[0]!.width);
  });

  it('escrita sem espaços é cortada em pedaços de poucos caracteres', () => {
    const segs = segmentLines(ZH);
    expect(segs.length).toBeGreaterThanOrEqual(4);
    expect(segs.every((s) => s.x1 > s.x0)).toBe(true);
  });

  it('a fronteira entre palavras fica no espaço, não dentro de uma letra', () => {
    const [a, b] = segmentLines([{ x: 0, y: 0, width: 100, height: 20, text: 'mm ii' }]);
    // "mm" é largo e "ii" estreito: a fronteira passa da metade da linha.
    expect(a!.x1).toBeGreaterThan(55);
    expect(a!.x1).toBeCloseTo(b!.x0);
  });

  it('larguras relativas: largas, estreitas e ideogramas', () => {
    expect(charWeight('m')).toBeGreaterThan(charWeight('a'));
    expect(charWeight('i')).toBeLessThan(charWeight('a'));
    expect(charWeight('你')).toBeGreaterThan(charWeight('M'));
    expect(charWeight('س')).toBe(1);
  });

  it('ignora linhas vazias', () => {
    expect(segmentLines([{ x: 0, y: 0, width: 0, height: 20, text: ' ' }])).toEqual([]);
  });
});

describe('litBy', () => {
  const seg = { line: 0, x0: 100, x1: 160, cx: 130, cy: 20 };
  it('acende quando a luz chega perto do meio da palavra', () => {
    expect(litBy(seg, 130, 20, 30, 24)).toBe(true);
    expect(litBy(seg, 95, 20, 30, 24)).toBe(true);
    expect(litBy(seg, 60, 20, 30, 24)).toBe(false);
  });
  it('não acende a linha de baixo', () => {
    expect(litBy(seg, 130, 62, 30, 24)).toBe(false);
  });
});

describe('planPath', () => {
  function litOrder(lines: TextLine[], rtl: boolean): number[] {
    const segs = segmentLines(lines, rtl);
    const path = planPath(lines, { rtl });
    const order: number[] = [];
    for (let t = 0; t <= pathDuration(path); t += 1 / 60) {
      const p = samplePath(path, t);
      segs.forEach((s, i) => {
        if (!order.includes(i) && litBy(s, p.x, p.y, 34, 26)) order.push(i);
      });
    }
    return order;
  }

  it('lê da esquerda para a direita, linha por linha, e acende todas as palavras em ordem', () => {
    const order = litOrder(PT, false);
    expect(order).toHaveLength(segmentLines(PT).length);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('em rtl lê da direita para a esquerda, também em ordem', () => {
    const order = litOrder(AR, true);
    expect(order).toHaveLength(segmentLines(AR, true).length);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const path = planPath(AR, { rtl: true });
    expect(path[0]!.x).toBeGreaterThan(path[30]!.x);
  });

  it('é lento: cada linha leva alguns segundos', () => {
    const d = pathDuration(planPath(PT));
    expect(d).toBeGreaterThan(6);
    expect(d).toBeLessThan(16);
  });

  it('o tempo cresce e a amostragem fica nas pontas fora do intervalo', () => {
    const path = planPath(PT);
    for (let i = 1; i < path.length; i++) expect(path[i]!.t).toBeGreaterThanOrEqual(path[i - 1]!.t);
    expect(samplePath(path, -1)).toEqual({ x: path[0]!.x, y: path[0]!.y });
    const last = path[path.length - 1]!;
    expect(samplePath(path, 999)).toEqual({ x: last.x, y: last.y });
  });
});

describe('stepLamp', () => {
  function run(s: LampSim, tx: number, ty: number, secs: number): LampSim[] {
    const out: LampSim[] = [];
    for (let i = 0; i < secs * 60; i++) {
      s = stepLamp(s, tx, ty, 1 / 60);
      out.push(s);
    }
    return out;
  }

  it('chega ao alvo passando um pouco dele (balanço de mola)', () => {
    const hist = run(restingSim(0, 0), 100, 0, 3);
    const maxX = Math.max(...hist.map((s) => s.x));
    expect(maxX).toBeGreaterThan(100);
    expect(maxX).toBeLessThan(110);
    expect(hist[hist.length - 1]!.x).toBeCloseTo(100, 1);
  });

  it('inclina para onde anda, a chama deita para trás e tudo volta ao repouso', () => {
    const hist = run(restingSim(0, 0), 200, 0, 4);
    const moving = hist[10]!;
    expect(moving.vx).toBeGreaterThan(0);
    expect(moving.tilt).toBeGreaterThan(0);
    expect(moving.lean).toBeLessThan(0);
    const end = hist[hist.length - 1]!;
    expect(Math.abs(end.tilt)).toBeLessThan(0.3);
    expect(Math.abs(end.lean)).toBeLessThan(0.3);
  });

  it('o corpo balança depois de parar (troca de sinal da inclinação)', () => {
    const hist = run(restingSim(0, 0), 150, 0, 3);
    const signs = new Set(hist.map((s) => Math.sign(Math.round(s.tilt * 10))));
    expect(signs.has(1) && signs.has(-1)).toBe(true);
  });

  it('descendo a chama se estica; subindo, encolhe', () => {
    expect(run(restingSim(0, 0), 0, 200, 0.2).pop()!.stretch).toBeGreaterThan(0);
    expect(run(restingSim(0, 0), 0, -200, 0.2).pop()!.stretch).toBeLessThan(0);
  });

  it('é estável com quadros longos', () => {
    const s = stepLamp(restingSim(0, 0), 300, 300, 0.5);
    expect(Number.isFinite(s.x) && Math.abs(s.x) < 1000).toBe(true);
  });
});

describe('flicker', () => {
  it('ruído fica em [-1, 1] e é determinístico', () => {
    for (let x = 0; x < 200; x += 0.37) {
      expect(Math.abs(noise1(x))).toBeLessThanOrEqual(1);
      expect(Math.abs(fbm1(x))).toBeLessThanOrEqual(1);
    }
    expect(flicker(3.2, 1)).toEqual(flicker(3.2, 1));
  });

  it('a chama varia pouco em torno do repouso', () => {
    for (let t = 0; t < 120; t += 0.05) {
      const f = flicker(t, 0.5);
      expect(f.scaleY).toBeGreaterThan(0.82);
      expect(f.scaleY).toBeLessThan(1.18);
      expect(f.scaleX).toBeGreaterThan(0.9);
      expect(Math.abs(f.sway)).toBeLessThan(12);
      expect(f.intensity).toBeGreaterThan(0.8);
    }
  });

  it('não repete em laço: trechos defasados são diferentes', () => {
    const at = (t0: number) => Array.from({ length: 60 }, (_, i) => flicker(t0 + i / 30, 2).scaleY);
    const a = at(0);
    for (const shift of [1, 2, 5, 10, 30]) {
      const b = at(shift);
      const diff = a.reduce((sum, v, i) => sum + Math.abs(v - b[i]!), 0) / a.length;
      expect(diff).toBeGreaterThan(0.005);
    }
  });

  it('"reduzir movimento" quase para a chama', () => {
    for (let t = 0; t < 30; t += 0.1) expect(Math.abs(flicker(t, 1, 0.1).scaleY - 1)).toBeLessThan(0.02);
  });
});
