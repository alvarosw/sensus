import { describe, expect, it } from 'vitest';
import { CitationStream, parseCited, safeParseLength, stripCitations } from '../src/index';

const VALID = new Set(['txt:blivre:50002005', 'tok:gnt:50002005:1', 'dic:easton:christ']);

describe('parseCited', () => {
  it('separa sentenças e extrai citações válidas e inválidas', () => {
    const text = 'Paulo exorta à unidade [[txt:blivre:50002005]]. A palavra ἐν aparece [[tok:gnt:50002005:1]] e [[txt:blivre:99999999]].';
    const segs = parseCited(text, VALID);

    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ kind: 'source', cites: ['txt:blivre:50002005'], invalidCites: [] });
    expect(segs[1]).toMatchObject({ kind: 'source', cites: ['tok:gnt:50002005:1'], invalidCites: ['txt:blivre:99999999'] });
    expect(segs.map((s) => s.text).join(' ')).not.toContain('[[');
  });

  it('aceita múltiplos ids em um marcador e a forma de colchete simples', () => {
    const segs = parseCited('Tese um [[txt:blivre:50002005, tok:gnt:50002005:1]]. Tese dois [dic:easton:christ].', VALID);
    expect(segs[0]?.cites).toEqual(['txt:blivre:50002005', 'tok:gnt:50002005:1']);
    expect(segs[1]?.cites).toEqual(['dic:easton:christ']);
  });

  it('classifica inferências, sentenças sem citação e ids só inválidos', () => {
    const segs = parseCited(
      '(Inferência) A humildade é um modelo para a igreja. Sem fonte aqui. Afirmação falsa [[nope]].',
      VALID,
    );
    expect(segs.map((s) => s.kind)).toEqual(['inference', 'uncited', 'uncited']);
    expect(segs[2]?.invalidCites).toEqual(['nope']);
  });

  it('anexa marcador isolado em linha própria à sentença anterior', () => {
    const segs = parseCited('Frase única.\n[[txt:blivre:50002005]]', VALID);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.cites).toEqual(['txt:blivre:50002005']);
  });

  it('separa parágrafos e itens de lista', () => {
    const segs = parseCited('Um parágrafo.\n\nOutro [[txt:blivre:50002005]].\n- item [[tok:gnt:50002005:1]]', VALID);
    expect(segs).toHaveLength(3);
    expect(segs[2]?.cites).toEqual(['tok:gnt:50002005:1']);
  });

  it('não quebra em números como 2.5 nem em abreviações sem espaço', () => {
    const segs = parseCited('Veja Fp 2.5 com [[txt:blivre:50002005]].', VALID);
    expect(segs).toHaveLength(1);
  });

  it('classifica títulos, rótulos e avisos de ausência como estrutura, não como fato', () => {
    const text = [
      '**1. Texto**',
      '',
      'O texto diz algo [[txt:blivre:50002005]].',
      '## Aplicação',
      'O contexto não traz registros para esta seção.',
      'Sem fonte aqui.',
      'Traduções:',
    ].join('\n');
    const segs = parseCited(text, VALID);
    expect(segs.map((s) => s.kind)).toEqual(['structure', 'source', 'structure', 'structure', 'uncited', 'structure']);
  });

  it('não separa "**1." de "Texto**" ao encontrar ponto depois de número', () => {
    const segs = parseCited('**1. Texto**', VALID);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.text).toBe('**1. Texto**');
    expect(segs[0]?.kind).toBe('structure');
  });

  it('nunca classifica uma inferência como estrutura', () => {
    expect(parseCited('**(Inferência)** Aplique à igreja.', VALID)[0]?.kind).toBe('inference');
  });

  it('remove marcadores do texto com stripCitations', () => {
    expect(stripCitations('Texto [[txt:blivre:50002005]] fim.')).toBe('Texto fim.');
  });
});

describe('streaming', () => {
  it('safeParseLength não corta marcador completo nem texto simples', () => {
    expect(safeParseLength('Texto simples')).toBe('Texto simples'.length);
    const done = 'Oi [[txt:blivre:50002005]] tudo';
    expect(safeParseLength(done)).toBe(done.length);
  });

  it('safeParseLength segura marcador parcial', () => {
    expect(safeParseLength('A [[txt:blivre:5000')).toBe(2);
    expect(safeParseLength('A [[txt:blivre:50002005]')).toBe(2);
    expect(safeParseLength('A [')).toBe(2);
    expect(safeParseLength('A [[')).toBe(2);
  });

  it('CitationStream nunca expõe um marcador pela metade', () => {
    const stream = new CitationStream(VALID);
    const chunks = ['Paulo exorta [[txt:bli', 'vre:50002005]]. Mais um', ' texto.'];
    const seen: string[] = [];

    for (const chunk of chunks) {
      for (const seg of stream.push(chunk)) seen.push(seg.text);
    }
    expect(seen.some((t) => t.includes('[['))).toBe(false);

    const final = stream.finish();
    expect(final[0]?.cites).toEqual(['txt:blivre:50002005']);
    expect(final[1]?.kind).toBe('uncited');
  });
});

describe('abreviações não encerram sentença', () => {
  it('não quebra em "vv." nem em "cf.", "Dt." ou "p. ex."', () => {
    expect(parseCited('A kenosis (vv. 6-11) é central. Outra frase.', VALID)).toHaveLength(2);
    expect(parseCited('Veja cf. Dt. 6:4 e p. ex. ainda aqui.', VALID)).toHaveLength(1);
    expect(parseCited('O hino (vv. 6-11) [[txt:blivre:50002005]].', VALID)[0]?.cites).toEqual(['txt:blivre:50002005']);
  });

  it('reconhece o id "xr:" de dois caracteres nas duas formas de citação', () => {
    const xr = new Set(['xr:openbible:50002005:50001002-50001002']);
    expect(parseCited('Veja [xr:openbible:50002005:50001002-50001002].', xr)[0]?.cites).toEqual([
      'xr:openbible:50002005:50001002-50001002',
    ]);
    expect(parseCited('Veja [[xr:openbible:50002005:50001002-50001002]].', xr)[0]?.kind).toBe('source');
  });
});

describe('avisos de ausência são estrutura', () => {
  it('"o contexto não traz fontes ..." é aviso, mas "sem fonte" continua sendo afirmação sem citação', () => {
    const segs = parseCited('O contexto não traz fontes rotuladas para esta passagem. Sem fonte aqui.', VALID);
    expect(segs.map((s) => s.kind)).toEqual(['structure', 'uncited']);
  });
});
