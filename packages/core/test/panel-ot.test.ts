// Painel no AT (hebraico e aramaico). Fixtures em fixtures-ot.ts. Comportamento atual, que deve continuar verde.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { buildPanel, Repo, type PanelData } from '../src/index';
import { createFixtureDb, driverFor } from './fixtures';
import { CONCORDANCE_VIDS_H0935, VID_1KGS_15_15, VID_DAN_2_4, seedOldTestament } from './fixtures-ot';

const RANGE_1KGS = { start: VID_1KGS_15_15, end: VID_1KGS_15_15 };
const RANGE_DAN = { start: VID_DAN_2_4, end: VID_DAN_2_4 };

let db: DatabaseSync;
let repo: Repo;

beforeEach(() => {
  db = createFixtureDb();
  seedOldTestament(db);
  repo = new Repo(driverFor(db));
});

afterEach(() => {
  db.close();
});

describe('buildPanel: 1Rs 15:15 (hebraico)', () => {
  let panel: PanelData;

  beforeEach(async () => {
    panel = await buildPanel(repo, RANGE_1KGS, { contextVerses: 1 });
  });

  it('monta a referência em pt-BR e preenche as seis camadas', () => {
    expect(panel.reference).toBe('1 Reis 15:15');
    expect(panel.range).toEqual(RANGE_1KGS);
    expect(panel.layers.text).toBeDefined();
    expect(panel.layers.literary).toBeDefined();
    expect(panel.layers.historical).toBeDefined();
    expect(panel.layers.language).toBeDefined();
    expect(panel.layers.intertext).toBeDefined();
    expect(panel.layers.interpretation).toBeDefined();
  });

  it('traz o texto em blivre, kjv e hebraico (hbo-wlc)', () => {
    const ids = panel.layers.text.translations.map((v) => v.cite_id);
    expect(ids).toEqual(
      expect.arrayContaining(['txt:blivre:11015015', 'txt:kjv:11015015', 'txt:hbo-wlc:11015015']),
    );
  });

  it('traz as 10 palavras hebraicas (tahot) em ordem, com o Qere na posição 5', () => {
    const original = panel.layers.text.original;
    expect(original.map((t) => t.corpus)).toEqual(Array(10).fill('hot'));
    expect(original.map((t) => t.pos)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(original.find((t) => t.pos === 5)?.editions).toBe('Q');
  });

  it('não marca variantes no hebraico: a comparação com TR/BYZ/NA é só do grego', () => {
    expect(panel.layers.text.variants).toEqual([]);
  });

  it('carrega o léxico TBESH de H0935 (todos os sufixos) e a concordância da palavra', () => {
    const lexH0935 = panel.layers.language.lexicon.filter((e) => e.strong_base === 'H0935');
    expect(lexH0935.map((e) => e.key)).toEqual([
      'H0935G', 'H0935H', 'H0935I', 'H0935J', 'H0935K', 'H0935L', 'H0935M', 'H0935N', 'H0935O', 'H0935P',
    ]);
    expect(lexH0935.every((e) => e.source_id === 'stepbible-tbesh')).toBe(true);

    const conc = panel.layers.language.concordance.H0935;
    expect(conc?.count).toBe(CONCORDANCE_VIDS_H0935.length + 1);
    expect(conc?.samples.length).toBeLessThanOrEqual(3);
  });

  it('faz concordância para cada strong_base do hebraico do versículo', () => {
    const bases = [...new Set(panel.layers.text.original.map((t) => t.strong_base))].sort();
    expect(Object.keys(panel.layers.language.concordance).sort()).toEqual(bases);
    // H0853 (אֵת, 'et) está em 1Rs 15:15 e em dois dos versículos de Gênesis da fixture: total 3.
    expect(panel.layers.language.concordance.H0853?.count).toBe(3);
  });

  it('traz os vizinhos em blivre e a divisão de parágrafo do hebraico', () => {
    expect(panel.layers.literary.before.map((v) => v.vid)).toEqual([11015014]);
    expect(panel.layers.literary.after.map((v) => v.vid)).toEqual([11015016]);
    // Petucha no hebraico começa em 15:9; a unidade vai do parágrafo de 15:9 até o último versículo da fixture.
    expect(panel.layers.literary.unit?.start).toBe(11015009);
  });
});

describe('buildPanel: Dn 2:4 (aramaico)', () => {
  let panel: PanelData;

  beforeEach(async () => {
    panel = await buildPanel(repo, RANGE_DAN, { contextVerses: 1 });
  });

  it('monta a referência e as camadas', () => {
    expect(panel.reference).toBe('Daniel 2:4');
    expect(panel.layers.text.translations.map((v) => v.cite_id)).toEqual(
      expect.arrayContaining(['txt:blivre:27002004', 'txt:kjv:27002004', 'txt:hbo-wlc:27002004']),
    );
  });

  it('traz as 12 palavras aramaicas (tahot, corpus hot) e o Qere na posição 10', () => {
    const original = panel.layers.text.original;
    expect(original).toHaveLength(12);
    expect(original.every((t) => t.corpus === 'hot')).toBe(true);
    expect(original.find((t) => t.pos === 10)?.editions).toBe('Q');
  });

  it('faz léxico e concordância das palavras aramaicas (H4430 aparece uma vez na fixture)', () => {
    const lexBases = new Set(panel.layers.language.lexicon.map((e) => e.strong_base));
    expect(lexBases.has('H4430')).toBe(true);
    expect(lexBases.has('H0935')).toBe(false);
    expect(panel.layers.language.concordance.H4430?.count).toBe(1);
  });

  it('não confunde o aramaico com o NT: nenhuma palavra grega no painel', () => {
    expect(panel.layers.text.original.some((t) => t.corpus === 'gnt')).toBe(false);
    expect(panel.layers.text.variants).toEqual([]);
  });
});
