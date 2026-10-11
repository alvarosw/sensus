import { describe, expect, it } from 'vitest';
import {
  assembleTranslation,
  segmentForTranslation,
  translatableRuns,
  type TextSegment,
} from '../src/index';

const runs = (text: string): string[] =>
  segmentForTranslation(text)
    .filter((s) => s.kind === 'translate')
    .map((s) => s.text);

const joined = (segs: TextSegment[]): string => segs.map((s) => s.text).join('');

describe('segmentForTranslation', () => {
  it('reproduz o texto original ao juntar os segmentos', () => {
    const samples = [
      'The form of God (μορφή) was not grasped, Phil. 2:6.',
      'Para um.\n\nPara dois, com G3444 e H1234.\n\n\nFim.',
      '  espaços nas bordas  ',
      '',
      '§ 12. See https://example.org/a?b=1). Done.',
    ];
    for (const s of samples) expect(joined(segmentForTranslation(s))).toBe(s);
  });

  it('traduz só a prosa em inglês e preserva grego', () => {
    expect(segmentForTranslation('The word μορφή means form.')).toEqual([
      { kind: 'translate', text: 'The word' },
      { kind: 'keep', text: ' μορφή ' },
      { kind: 'translate', text: 'means form.' },
    ]);
  });

  it('mantém sequências de palavras gregas juntas num único trecho preservado', () => {
    const segs = segmentForTranslation('In ἐν μορφῇ θεοῦ ὑπάρχων, he was');
    expect(segs.filter((s) => s.kind === 'keep').map((s) => s.text)).toContain(' ἐν μορφῇ θεοῦ ὑπάρχων, ');
    expect(translatableRuns(segs)).toEqual(['In', 'he was']);
  });

  it('protege números de Strong (G e H)', () => {
    expect(runs('See G3444 and H1234 in context.')).toEqual(['See', 'and', 'in context.']);
  });

  it('protege referências bíblicas em formatos variados', () => {
    expect(runs('as in Php.2.6 and Phil. 2:6 and Rm 8:28 too')).toEqual(['as in', 'and', 'and', 'too']);
    expect(runs('Compare Romans 8:28-30 with 1 Cor. 13:4.')).toEqual(['Compare', 'with']);
  });

  it('não protege palavras comuns em minúscula seguidas de número', () => {
    expect(runs('the ratio is 3:2 here')).toEqual(['the ratio is 3:2 here']);
  });

  it('protege URLs e marcas de seção com números', () => {
    const segs = segmentForTranslation('Source: https://www.perseus.tufts.edu/hopper/text?doc=1. Cf. § 12.3 and ¶ 4.');
    const keep = segs.filter((s) => s.kind === 'keep').map((s) => s.text).join('');
    expect(keep).toContain('https://www.perseus.tufts.edu/hopper/text?doc=1');
    expect(keep).toContain('§ 12.3');
    expect(keep).toContain('¶ 4');
  });

  it('protege abreviações de léxico', () => {
    const segs = segmentForTranslation('Used in Hom. Il. and cf. the fem. noun, e.g. Plato.');
    const keep = segs.filter((s) => s.kind === 'keep').map((s) => s.text).join('|');
    expect(keep).toContain('cf.');
    expect(keep).toContain('fem.');
    expect(keep).toContain('e.g.');
  });

  it('protege siglas de léxico e fontes (AS, BDB, LSJ, Thayer, LXX, NA28, TR...)', () => {
    const text = 'Abbott-Smith (AS) and BDB, LSJ, BDAG, TDNT, Thayer, Strong, LXX, MT, NT, OT, KJV, AV, RV, ASV, NA27, NA28, TR, Byz.';
    const keep = segmentForTranslation(text).filter((s) => s.kind === 'keep').map((s) => s.text).join('|');
    for (const sigla of ['(AS)', 'BDB', 'LSJ', 'BDAG', 'TDNT', 'Thayer', 'Strong', 'LXX', 'MT', 'NT', 'OT', 'KJV', 'AV', 'RV', 'ASV', 'NA27', 'NA28', 'TR', 'Byz']) {
      expect(keep).toContain(sigla);
    }
    expect(joined(segmentForTranslation(text))).toBe(text);
  });

  it('não traduz "(AS)" dentro de uma nota de léxico (regressão: virava "(Como)")', () => {
    const segs = segmentForTranslation('ἀγάπη (AS) — love, charity.');
    expect(segs.some((s) => s.kind === 'translate' && s.text.includes('AS'))).toBe(false);
    expect(segs.filter((s) => s.kind === 'keep').map((s) => s.text).join('')).toContain('(AS)');
    expect(runs('Abbott-Smith (AS) gives the sense.')).toEqual(['Abbott-Smith', 'gives the sense.']);
  });

  it('protege parênteses com sigla em maiúsculas (1 a 6 letras) e não pega palavras em minúscula', () => {
    expect(runs('see (TDNT) and (BDAGGG)')).toEqual(['see', 'and']);
    expect(runs('see (ABCDEFG) now')).toEqual(['see (ABCDEFG) now']);
  });

  it('protege cf. e ibid. em notas', () => {
    const keep = segmentForTranslation('So cf. Thayer, ibid. and cf. Mt 5:3.').filter((s) => s.kind === 'keep').map((s) => s.text).join('|');
    expect(keep).toContain('cf.');
    expect(keep).toContain('ibid.');
    expect(keep).toContain('Mt 5:3');
  });

  it('mantém quebras de parágrafo e traduz cada parágrafo separadamente', () => {
    const text = 'First paragraph here.\n\nSecond paragraph here.';
    expect(segmentForTranslation(text)).toEqual([
      { kind: 'translate', text: 'First paragraph here.' },
      { kind: 'keep', text: '\n\n' },
      { kind: 'translate', text: 'Second paragraph here.' },
    ]);
  });

  it('não traduz trechos sem palavras em inglês (pontuação e números)', () => {
    expect(runs('(1) — 2, 3; [4]')).toEqual([]);
  });

  it('converte quebras de linha simples dentro de um trecho em espaço', () => {
    expect(runs('line one\nline two')).toEqual(['line one line two']);
  });
});

describe('translatableRuns e assembleTranslation', () => {
  it('lista trechos únicos e remonta com as traduções', () => {
    const text = 'Form (μορφή) of God.\n\nForm of God.';
    const segs = segmentForTranslation(text);
    expect(translatableRuns(segs)).toEqual(['Form', 'of God.', 'Form of God.']);
    const tr: Record<string, string> = { Form: 'Forma', 'of God.': 'de Deus.', 'Form of God.': 'Forma de Deus.' };
    expect(assembleTranslation(segs, (run) => tr[run])).toBe('Forma (μορφή) de Deus.\n\nForma de Deus.');
  });

  it('mantém o original quando não há tradução para um trecho', () => {
    const segs = segmentForTranslation('Hello there (ἀγάπη).');
    expect(assembleTranslation(segs, () => undefined)).toBe('Hello there (ἀγάπη).');
  });
});
