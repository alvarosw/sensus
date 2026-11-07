// Preferência de comentários no Repo: filtro das consultas (comentários, contagem escondida, citação por cite_id),
// painel e o contexto que vai para a IA. NT grego (Fp 2:5-8) e AT hebraico (1Rs 15:15).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { ALL_COMMENTARIES, buildPanel, makeVid, Repo, serializePanel, type CommentaryPreference } from '../src/index';
import { createFixtureDb, driverFor, insert, source } from './fixtures';
import { VID_1KGS_15_15, seedOldTestament } from './fixtures-ot';

const RANGE_FP = { start: makeVid(50, 2, 5), end: makeVid(50, 2, 8) };
const RANGE_1KGS = { start: VID_1KGS_15_15, end: VID_1KGS_15_15 };

const ids = (rows: { cite_id: string }[]): string[] => rows.map((r) => r.cite_id);

/** Comentários do AT (fixture mínima, criada aqui): um adventista e um luterano sobre 1Rs 15:15. */
function seedOldTestamentCommentaries(db: DatabaseSync): void {
  insert(db, 'source', [
    source('egw-teste', 'commentary', 'Comentário adventista de teste', { tradition: 'adventist', lang: 'en' }),
    source('kd-teste', 'commentary', 'Comentário luterano de teste', { tradition: 'lutheran', lang: 'en' }),
  ]);
  insert(db, 'commentary', [
    {
      cite_id: `com:egw-teste:${VID_1KGS_15_15}-${VID_1KGS_15_15}`,
      source_id: 'egw-teste',
      start_vid: VID_1KGS_15_15,
      end_vid: VID_1KGS_15_15,
      text: 'Asa, rei de Judá, tinha um coração inteiro para com o Senhor.',
    },
    {
      cite_id: `com:kd-teste:${VID_1KGS_15_15}-${VID_1KGS_15_15}`,
      source_id: 'kd-teste',
      start_vid: VID_1KGS_15_15,
      end_vid: VID_1KGS_15_15,
      text: 'Comentário luterano sobre a dedicação de Asa.',
    },
  ]);
}

let db: DatabaseSync;
let repo: Repo;

beforeEach(() => {
  db = createFixtureDb();
  seedOldTestament(db);
  seedOldTestamentCommentaries(db);
  repo = new Repo(driverFor(db));
});

afterEach(() => {
  db.close();
});

describe('preferência de comentários no Repo (NT grego, Fp 2:5-8)', () => {
  it('sem preferência, vê as duas tradições e as introduções do livro e do capítulo', async () => {
    expect(repo.getCommentaryPreference()).toEqual(ALL_COMMENTARIES);
    expect(ids(await repo.commentaries(RANGE_FP))).toEqual([
      'com:com-disp:50000000-50000000',
      'com:com-ref:50002000-50002000',
      'com:com-disp:50002005-50002011',
      'com:com-ref:50002005-50002011',
    ]);
  });

  it('com tradição escolhida, só ela aparece em comentários e introduções', async () => {
    repo.setCommentaryPreference({ traditions: ['reformed'], hiddenSources: [] });
    expect(ids(await repo.commentaries(RANGE_FP))).toEqual(['com:com-ref:50002000-50002000', 'com:com-ref:50002005-50002011']);
  });

  it('conta quantos comentários do trecho a preferência escondeu', async () => {
    repo.setCommentaryPreference({ traditions: ['reformed'], hiddenSources: [] });
    const split = await repo.commentariesAndHidden(RANGE_FP);
    expect(split.visible).toHaveLength(2);
    expect(split.hidden).toBe(2);
  });

  it('fonte escondida sai mesmo com a tradição aceita', async () => {
    repo.setCommentaryPreference({ traditions: null, hiddenSources: ['com-ref'] });
    expect(ids(await repo.commentaries(RANGE_FP))).toEqual(['com:com-disp:50000000-50000000', 'com:com-disp:50002005-50002011']);
  });

  it('citação de comentário escondido não resolve; a visível resolve', async () => {
    repo.setCommentaryPreference({ traditions: ['reformed'], hiddenSources: [] });
    expect(await repo.resolveCite('com:com-disp:50002005-50002011')).toBeNull();
    const hit = await repo.resolveCite('com:com-ref:50002005-50002011');
    expect(hit?.table).toBe('commentary');
  });

  it('o painel e o contexto da IA não recebem comentário escondido', async () => {
    repo.setCommentaryPreference({ traditions: ['reformed'], hiddenSources: [] });
    const panel = await buildPanel(repo, RANGE_FP);
    expect(panel.layers.interpretation.commentaries.map((c) => c.source_id).every((s) => s === 'com-ref')).toBe(true);
    expect(panel.layers.interpretation.hiddenCommentaries).toBe(2);
    expect(panel.sources['com-disp']).toBeUndefined();

    const context = serializePanel(panel);
    expect(context.text).toContain('Paulo exorta à unidade');
    expect(context.text).not.toContain('Leitura dispensacional');
    expect(context.text).not.toContain('Introdução ao livro de Filipenses');
    expect([...context.citeIds].some((id) => id.startsWith('com:com-disp:'))).toBe(false);
  });

  it('sem preferência, o painel traz as duas tradições e nenhum escondido', async () => {
    const panel = await buildPanel(repo, RANGE_FP);
    expect(panel.layers.interpretation.commentaries).toHaveLength(4);
    expect(panel.layers.interpretation.hiddenCommentaries).toBe(0);
    expect(panel.sources['com-disp']).toBeDefined();
  });
});

describe('preferência de comentários no Repo (AT hebraico, 1Rs 15:15)', () => {
  it('sem filtro, vê os dois comentários do AT', async () => {
    expect(ids(await repo.commentaries(RANGE_1KGS)).sort()).toEqual(
      [`com:egw-teste:${VID_1KGS_15_15}-${VID_1KGS_15_15}`, `com:kd-teste:${VID_1KGS_15_15}-${VID_1KGS_15_15}`].sort(),
    );
  });

  it('tradição adventista esconde o luterano e o contexto do painel acompanha', async () => {
    repo.setCommentaryPreference({ traditions: ['adventist'], hiddenSources: [] });
    expect(ids(await repo.commentaries(RANGE_1KGS))).toEqual([`com:egw-teste:${VID_1KGS_15_15}-${VID_1KGS_15_15}`]);
    const panel = await buildPanel(repo, RANGE_1KGS);
    const context = serializePanel(panel);
    expect(context.text).toContain('coração inteiro');
    expect(context.text).not.toContain('dedicação de Asa');
    expect(panel.layers.interpretation.hiddenCommentaries).toBe(1);
  });

  it('o comentário adventista some quando a fonte é escondida, mesmo com a tradição aceita', async () => {
    const pref: CommentaryPreference = { traditions: ['adventist'], hiddenSources: ['egw-teste'] };
    repo.setCommentaryPreference(pref);
    expect(await repo.commentaries(RANGE_1KGS)).toEqual([]);
    expect((await repo.commentariesAndHidden(RANGE_1KGS)).hidden).toBe(2);
  });

  it('preferência gravada inválida no Repo cai para todas as tradições', async () => {
    repo.setCommentaryPreference({ traditions: [], hiddenSources: [] });
    expect(repo.getCommentaryPreference()).toEqual(ALL_COMMENTARIES);
    expect(await repo.commentaries(RANGE_1KGS)).toHaveLength(2);
  });
});
