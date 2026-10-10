// Banco de teste: esquema real (pipeline/schema.sql) em memória, com um conjunto pequeno de Filipenses.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { SqlDriver, SqlParam } from '../src/types';

const SCHEMA = new URL('../../../pipeline/schema.sql', import.meta.url);

type Row = Record<string, SqlParam>;

function insert(db: DatabaseSync, table: string, rows: Row[]): void {
  for (const row of rows) {
    const cols = Object.keys(row);
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    db.prepare(sql).run(...cols.map((c) => row[c] ?? null));
  }
}

function source(id: string, kind: string, title: string, extra: Row = {}): Row {
  return {
    id,
    kind,
    title,
    author: null,
    lang: 'pt',
    license: 'Public Domain',
    license_url: null,
    url: 'https://example.test/source',
    version: '1',
    retrieved_at: '2026-01-01T00:00:00Z',
    attribution: null,
    tradition: null,
    notes: null,
    ...extra,
  };
}

function token(vid: number, pos: number, surface: string, base: string, editions: string, extra: Row = {}): Row {
  return {
    cite_id: `tok:gnt:${vid}:${pos}`,
    source_id: 'tagnt',
    corpus: 'gnt',
    vid,
    pos,
    surface,
    translit: null,
    lemma: null,
    strong: base,
    strong_base: base,
    morph: null,
    morph_desc: null,
    gloss_en: null,
    editions,
    variant_note: null,
    alt_ref: null,
    ...extra,
  };
}

/** Cria o banco de teste com esquema real e dados de Filipenses 1-3 (trechos). */
export function createFixtureDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(SCHEMA, 'utf8'));

  insert(db, 'book', [
    { num: 50, osis: 'Phil', name_pt: 'Filipenses', name_en: 'Philippians', testament: 'NT', chapters: 4 },
    { num: 51, osis: 'Col', name_pt: 'Colossenses', name_en: 'Colossians', testament: 'NT', chapters: 4 },
  ]);

  insert(db, 'source', [
    source('blivre', 'text', 'Bíblia Livre'),
    source('kjv', 'text', 'King James Version', { lang: 'en' }),
    source('tagnt', 'tokens', 'TAGNT (STEPBible)', { lang: 'grc' }),
    source('strongs-gr', 'lexicon', 'Strong (grego)'),
    source('com-ref', 'commentary', 'Comentário Reformado', { tradition: 'reformed' }),
    source('com-disp', 'commentary', 'Comentário Dispensacional', { tradition: 'dispensational' }),
    source('easton', 'dictionary', 'Dicionário de Easton', { lang: 'en' }),
    source('nave', 'topical', 'Índice temático de Nave', { lang: 'en' }),
    source('openbible', 'xref', 'OpenBible'),
    source('isbe-ent', 'entity', 'Entidades (ISBE)', { lang: 'en' }),
  ]);

  const verses: Array<[string, number, string]> = [
    ['blivre', 50001001, 'Paulo e Timóteo, servos de Cristo Jesus, a todos os santos em Cristo Jesus.'],
    ['blivre', 50001002, 'Graça a vós outros e paz, da parte de Deus nosso Pai e do Senhor Jesus Cristo.'],
    ['blivre', 50002004, 'não olhando cada um para o que é seu, mas cada um também para o que é dos outros.'],
    ['blivre', 50002005, 'Tende em vós o mesmo sentimento que houve também em Cristo Jesus,'],
    ['blivre', 50002006, 'o qual, sendo em forma de Deus, não teve por usurpação ser igual a Deus,'],
    ['blivre', 50002007, 'mas esvaziou-se a si mesmo, tomando a forma de servo, e tornando-se semelhante aos homens;'],
    ['blivre', 50002008, 'e, achado na forma de homem, humilhou-se a si mesmo, sendo obediente até à morte, e morte de cruz.'],
    ['blivre', 50002009, 'Pelo que também Deus o exaltou sobremaneira, e lhe deu um nome que é sobre todo o nome;'],
    ['blivre', 50003001, 'Quanto ao mais, irmãos meus, alegrai-vos no Senhor.'],
    ['kjv', 50002005, 'Let this mind be in you, which was also in Christ Jesus:'],
  ];
  insert(
    db,
    'verse_text',
    verses.map(([sourceId, vid, text]) => ({ cite_id: `txt:${sourceId}:${vid}`, source_id: sourceId, vid, text })),
  );

  insert(db, 'text_division', [
    { source_id: 'blivre', vid: 50001001, kind: 'heading', title: 'Saudação' },
    { source_id: 'blivre', vid: 50002005, kind: 'heading', title: 'O exemplo de Cristo' },
    { source_id: 'blivre', vid: 50003001, kind: 'paragraph', title: null },
  ]);

  insert(db, 'token', [
    token(50002005, 1, 'Τοῦτο', 'G5124', 'TR,BYZ,NA', { lemma: 'οὗτος', morph: 'CASN', gloss_en: 'this' }),
    token(50002005, 2, 'φρονεῖτε', 'G5426', 'TR,BYZ,NA', {
      lemma: 'φρονέω',
      morph: 'V-PAM-2P',
      morph_desc: 'Verb; Tense=Present; Voice=Active; Mood=Imperative; Person=2nd; Number=Plural',
      gloss_en: 'be minded',
    }),
    token(50002005, 3, 'ἐν', 'G1722', 'TR,BYZ,NA', { lemma: 'ἐν', morph: 'PREP', morph_desc: 'Preposition', gloss_en: 'in' }),
    token(50002006, 4, 'Ὃς', 'G3739', 'TR,BYZ,NA', { lemma: 'ὅς', gloss_en: 'who' }),
    token(50002006, 5, 'ἐν', 'G1722', 'TR,BYZ', { lemma: 'ἐν', gloss_en: 'in', variant_note: 'NA omite' }),
    token(50002007, 6, 'Ἰησοῦς', 'G2424', 'TR,BYZ,NA', { lemma: 'Ἰησοῦς', gloss_en: 'Jesus' }),
    token(50002008, 7, 'ἑαυτὸν', 'G1438', 'BYZ,NA', { lemma: 'ἑαυτοῦ', gloss_en: 'himself', variant_note: 'ausente no TR' }),
    token(50001001, 1, 'Παῦλος', 'G3972', 'TR,BYZ,NA', { lemma: 'Παῦλος', gloss_en: 'Paul' }),
    token(50001001, 2, 'ἐν', 'G1722', 'TR,BYZ,NA', { lemma: 'ἐν', gloss_en: 'in' }),
  ]);

  insert(db, 'lexicon_entry', [
    {
      cite_id: 'lex:strongs-gr:G1722',
      source_id: 'strongs-gr',
      key: 'G1722',
      strong_base: 'G1722',
      lemma: 'ἐν',
      translit: 'en',
      gloss: 'em',
      definition: 'Preposição de lugar, tempo ou instrumento; indica estar dentro de algo ou de alguém.',
      lang: 'pt',
    },
    {
      cite_id: 'lex:strongs-gr:G5426',
      source_id: 'strongs-gr',
      key: 'G5426',
      strong_base: 'G5426',
      lemma: 'φρονέω',
      translit: 'phroneō',
      gloss: 'pensar, ter a mente voltada para',
      definition: 'Ter uma disposição mental; pensar, sentir ou ter a mente de alguém.',
      lang: 'pt',
    },
    {
      cite_id: 'lex:strongs-gr:G2424',
      source_id: 'strongs-gr',
      key: 'G2424',
      strong_base: 'G2424',
      lemma: 'Ἰησοῦς',
      translit: 'Iēsous',
      gloss: 'Jesus',
      definition: 'Nome do Senhor, o Filho de Deus encarnado.',
      lang: 'pt',
    },
  ]);

  insert(db, 'commentary', [
    {
      cite_id: 'com:com-ref:50002000-50002000',
      source_id: 'com-ref',
      start_vid: 50002000,
      end_vid: 50002000,
      text: 'Introdução ao capítulo 2: o tema é a humildade da comunidade.',
    },
    {
      cite_id: 'com:com-ref:50002005-50002011',
      source_id: 'com-ref',
      start_vid: 50002005,
      end_vid: 50002011,
      text: 'Paulo exorta à unidade e ao sentimento de Cristo. O trecho 2:6-11 é um hino cristológico.',
    },
    {
      cite_id: 'com:com-ref:50003001-50003005',
      source_id: 'com-ref',
      start_vid: 50003001,
      end_vid: 50003005,
      text: 'Comentário fora do intervalo de teste.',
    },
    {
      cite_id: 'com:com-disp:50000000-50000000',
      source_id: 'com-disp',
      start_vid: 50000000,
      end_vid: 50000000,
      text: 'Introdução ao livro de Filipenses.',
    },
    {
      cite_id: 'com:com-disp:50002005-50002011',
      source_id: 'com-disp',
      start_vid: 50002005,
      end_vid: 50002011,
      text: 'Leitura dispensacional: enfatiza o contraste entre a humilhação presente e a exaltação futura de Cristo.',
    },
  ]);

  insert(db, 'dictionary_entry', [
    {
      cite_id: 'dic:easton:philippians-epistle-to-the',
      source_id: 'easton',
      headword: 'Philippians, Epistle to the',
      text: 'Carta escrita por Paulo a partir de Roma, durante uma prisão.',
    },
    { cite_id: 'dic:easton:christ', source_id: 'easton', headword: 'Christ', text: 'Ungido; título de Jesus como Messias.' },
    { cite_id: 'dic:easton:philippi', source_id: 'easton', headword: 'Philippi', text: 'Cidade da Macedônia.' },
    { cite_id: 'dic:nave:humility', source_id: 'nave', headword: 'Humility', text: 'Humildade: ver Filipenses 2:5-8.' },
  ]);

  insert(db, 'entry_ref', [
    { entry_cite_id: 'dic:easton:philippians-epistle-to-the', start_vid: 50001001, end_vid: 50004023 },
    { entry_cite_id: 'dic:easton:christ', start_vid: 50002005, end_vid: 50002011 },
    { entry_cite_id: 'dic:easton:philippi', start_vid: 50001001, end_vid: 50001001 },
    { entry_cite_id: 'dic:nave:humility', start_vid: 50002005, end_vid: 50002008 },
  ]);

  insert(db, 'xref', [
    { cite_id: 'xr:openbible:50002005:50001002-50001002', source_id: 'openbible', from_vid: 50002005, to_start_vid: 50001002, to_end_vid: 50001002, weight: 9.5 },
    { cite_id: 'xr:openbible:50002006:50003001-50003001', source_id: 'openbible', from_vid: 50002006, to_start_vid: 50003001, to_end_vid: 50003001, weight: 2.0 },
    { cite_id: 'xr:openbible:50002007:50002005-50002006', source_id: 'openbible', from_vid: 50002007, to_start_vid: 50002005, to_end_vid: 50002006, weight: null },
    { cite_id: 'xr:openbible:50003001:50002005-50002005', source_id: 'openbible', from_vid: 50003001, to_start_vid: 50002005, to_end_vid: 50002005, weight: 5.0 },
  ]);

  insert(db, 'entity', [
    { cite_id: 'ent:isbe-ent:paulo', source_id: 'isbe-ent', type: 'person', name: 'Paulo', description: 'Apóstolo, autor da carta.' },
    { cite_id: 'ent:isbe-ent:filipos', source_id: 'isbe-ent', type: 'place', name: 'Filipos', description: 'Cidade da Macedônia.' },
  ]);
  insert(db, 'entity_ref', [
    { entity_cite_id: 'ent:isbe-ent:paulo', vid: 50001001, token_pos: null },
    { entity_cite_id: 'ent:isbe-ent:paulo', vid: 50002005, token_pos: null },
    { entity_cite_id: 'ent:isbe-ent:filipos', vid: 50001001, token_pos: null },
  ]);

  return db;
}

/** Adaptador SqlDriver sobre node:sqlite (o mesmo padrão usado por tools/ask.ts). */
export function driverFor(db: DatabaseSync): SqlDriver {
  return {
    async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as unknown as T[];
    },
  };
}
