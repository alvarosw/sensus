import { describe, expect, it } from 'vitest';
import { CitationStream, citeIdsOfMarker, parseCited, safeParseLength, stripCitations } from '../src/index';

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
      'Sem fonte aqui. (Inferência) A humildade é um modelo para a igreja. Afirmação falsa [[nope]].',
      VALID,
    );
    expect(segs.map((s) => s.kind)).toEqual(['uncited', 'inference', 'uncited']);
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

describe('rótulo de inferência: todas as grafias que o modelo usa', () => {
  const LABELS = [
    '(Inferência)',
    '(inferência)',
    '(Inferência):',
    '**(Inferência)**',
    '*(Inferência)*',
    '_(Inferência)_',
    '_Inferência:_',
    '**Inferência:**',
    'Inferência:',
    '  (  Inferência  )  ',
    '**(Inferência)**:',
  ];

  it.each(LABELS)('%j no início da frase classifica como inferência', (label) => {
    const segs = parseCited(`${label} A humildade é um modelo para a igreja.`, VALID);
    expect(segs.map((s) => s.kind)).toEqual(['inference']);
  });

  it.each(['- ', '* ', '1. ', '> ', '"', '“'])('marcador de lista ou aspa (%j) antes do rótulo', (prefix) => {
    expect(parseCited(`${prefix}(Inferência) Aplique à igreja.`, VALID)[0]?.kind).toBe('inference');
  });

  it('um negrito inicial ("**Efeito na conexão lógica** (Inferência) …") também conta', () => {
    // Trecho real (filipenses-2-5-8.answer.2), com o rótulo depois do título em negrito.
    const text =
      '**Efeito na conexão lógica** (Inferência) A omissão de γὰρ remove um marcador explícito de fundamentação (“pois”, “porque”) que ligaria o imperativo do v. 5 à exortação do v. 4. Sem essa partícula, a relação argumentativa torna-se menos explícita, embora o contexto imediato ainda possa sugerir continuidade.';
    const segs = parseCited(text, VALID);
    expect(segs.map((s) => s.kind)).toEqual(['inference', 'inference']);
  });

  it('"Inferência" sem dois-pontos nem parênteses é palavra comum, não rótulo', () => {
    expect(parseCited('Inferência bíblica exige contexto.', VALID)[0]?.kind).toBe('uncited');
  });

  it('o rótulo também começa uma frase no meio do parágrafo', () => {
    const segs = parseCited(
      'Fato com fonte [[txt:blivre:50002005]]. (Inferência) A igreja deve imitar Cristo. **(Inferência)** Aplique.',
      VALID,
    );
    expect(segs.map((s) => s.kind)).toEqual(['source', 'inference', 'inference']);
  });

  it('um rótulo sozinho depois de frases sem citação marca essas frases como inferência', () => {
    // Trecho real (filipenses-1-27-2-4.answer.2): o rótulo vem no fim do item.
    const text =
      'A leitura *τινα* (plural neutro) não concorda com *παράκλησις*; gramaticalmente esperaria um substantivo plural neutro (ex.: “consolações”). (Inferência)';
    expect(parseCited(text, VALID).map((s) => s.kind)).toEqual(['inference', 'inference', 'inference']);
  });

  it('a frase inicial com rótulo faz as frases sem citação seguintes serem inferência, até a primeira citação', () => {
    const segs = parseCited('(Inferência) Imite Cristo. Sem fonte nesta frase. Com fonte [[txt:blivre:50002005]]. Nova sem fonte.', VALID);
    expect(segs.map((s) => s.kind)).toEqual(['inference', 'inference', 'source', 'uncited']);
  });
});

describe('atribuição: uma citação vale para as frases sem fonte anteriores no mesmo parágrafo', () => {
  it('a citação no fim do parágrafo cobre as frases anteriores, com as citações do grupo', () => {
    const segs = parseCited('Primeira afirmação. Segunda afirmação [[txt:blivre:50002005]].', VALID);
    expect(segs.map((s) => s.kind)).toEqual(['source', 'source']);
    expect(segs[0]?.cites).toEqual(['txt:blivre:50002005']);
  });

  it('a cobertura para na citação anterior', () => {
    const segs = parseCited('Antiga sem fonte. Nova com fonte [[txt:blivre:50002005]]. Depois sem fonte. Fim.', VALID);
    expect(segs.map((s) => s.kind)).toEqual(['source', 'source', 'uncited', 'uncited']);
  });

  it('inferência e frase de estrutura não contam como sem fonte e não interrompem a cobertura', () => {
    const segs = parseCited(
      'Fato sem fonte. (Inferência) Imite Cristo. Pergunta sobre isso? Outro fato [[txt:blivre:50002005]].',
      VALID,
    );
    expect(segs.map((s) => s.kind)).toEqual(['source', 'inference', 'structure', 'source']);
  });

  it('parágrafos diferentes não se cobrem', () => {
    expect(parseCited('Sem fonte.\n\nCom fonte [[txt:blivre:50002005]].', VALID).map((s) => s.kind)).toEqual([
      'uncited',
      'source',
    ]);
  });

  it('citação inválida não cobre nada', () => {
    expect(parseCited('Sem fonte. Inventada [[nope]].', VALID).map((s) => s.kind)).toEqual(['uncited', 'uncited']);
  });

  it('ponto dentro de parênteses não separa a frase (a citação fecha a frase inteira)', () => {
    // Trecho real (filipenses-2-5-8.answer.1, na forma em que o modelo escreveu).
    const segs = parseCited(
      'O sentido é ativo (vide Fp 2:6…; BYZ diz "tó" e NA diz "ἁρπαγμὸν"). Outro ponto [[txt:blivre:50002005]].',
      VALID,
    );
    expect(segs.map((s) => s.kind)).toEqual(['source', 'source']);
  });

  it.each([
    'O contexto não traz registros para esta seção.',
    'O contexto não traz comentários dispensacionalistas para esta passagem.',
    'O contexto traz comentários de várias tradições.',
    '**Observação**: O contexto não traz fontes de aliança sobre esta passagem.',
    'Abaixo, cada tradição é resumida.',
    'Qual é o sentido de ἁρπαγμὸν?',
  ])('frase sobre o contexto ou pergunta é estrutura, não afirmação sem fonte: %s', (text) => {
    expect(parseCited(text, VALID)[0]?.kind).toBe('structure');
  });
});

describe('rótulo só no fim da primeira frase não faz o parágrafo inteiro ser inferência', () => {
  it('a frase inicial que termina com "(Inferência)" marca só ela; a seguinte sem rótulo continua sem fonte', () => {
    const segs = parseCited('Fato curto (Inferência). Outra frase sem fonte.', VALID);
    expect(segs.map((s) => s.kind)).toEqual(['inference', 'uncited']);
  });
});

describe('marcadores com colchete simples, listas em colchetes e links Markdown', () => {
  it('colchete simples com id válido vira citação, sem o colchete no texto', () => {
    const segs = parseCited('Paulo exorta à unidade [txt:blivre:50002005].', VALID);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ kind: 'source', cites: ['txt:blivre:50002005'], text: 'Paulo exorta à unidade.' });
  });

  it('[[id], [id]] (forma do Nemotron Ultra) vale como uma citação com os dois ids', () => {
    const segs = parseCited('Verbo feito por meio dele [[txt:blivre:50002005], [tok:gnt:50002005:1]].', VALID);
    expect(segs[0]).toMatchObject({ kind: 'source', cites: ['txt:blivre:50002005', 'tok:gnt:50002005:1'], text: 'Verbo feito por meio dele.' });
  });

  it('[id] [id] com espaço, sem vírgula, também é lista', () => {
    const segs = parseCited('Forma [[tok:gnt:50002005:1] [txt:blivre:50002005]] aqui.', VALID);
    expect(segs[0]).toMatchObject({ kind: 'source', cites: ['tok:gnt:50002005:1', 'txt:blivre:50002005'] });
  });

  it('colchete com prefixo de id fora do contexto é citação inválida, como os demais marcadores', () => {
    const segs = parseCited('Fato [com:sword-gill:50002006-50002006].', VALID);
    expect(segs[0]).toMatchObject({ kind: 'uncited', cites: [], invalidCites: ['com:sword-gill:50002006-50002006'] });
  });

  it('colchetes comuns e links Markdown não são citação', () => {
    const segs = parseCited('Veja [Mateus](https://example.org) e [contexto] e [1] e [txt: texto livre].', VALID);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.cites).toEqual([]);
    expect(segs[0]!.invalidCites).toEqual([]);
    expect(segs[0]!.text).toContain('[contexto]');
    expect(segs[0]!.text).toContain('[Mateus](https://example.org)');
  });

  it('citeIdsOfMarker tira colchetes e separa ids em qualquer forma', () => {
    expect(citeIdsOfMarker('[txt:blivre:50002005]')).toEqual(['txt:blivre:50002005']);
    expect(citeIdsOfMarker('[[txt:a:1], [tok:b:2]]')).toEqual(['txt:a:1', 'tok:b:2']);
    expect(citeIdsOfMarker('[[lex:c:G1] [lex:c:G2]]')).toEqual(['lex:c:G1', 'lex:c:G2']);
    expect(citeIdsOfMarker('[[txt:a:1; tok:b:2]]')).toEqual(['txt:a:1', 'tok:b:2']);
  });
});
