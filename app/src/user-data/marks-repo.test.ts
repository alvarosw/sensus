// Repositório das marcas contra um SQLite de verdade (node:sqlite, em memória), com as migrações do app.
// Um adaptador fino expõe a mesma forma assíncrona do expo-sqlite que o código usa.
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeVid } from '@sensus/core';
import { migrateUserDb } from './migrations';
import { applyPlan, loadMarks, revertChange } from './marks-repo';
import { paintPlan, type Mark, type MarkPlan, type NewMark } from './marks-model';
import type { SQLiteDatabase } from 'expo-sqlite';

function adapt(raw: DatabaseSync) {
  const api = {
    async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      return (raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null;
    },
    async runAsync(sql: string, params: unknown[] = []) {
      const r = raw.prepare(sql).run(...(params as never[]));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async withTransactionAsync(task: () => Promise<void>) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return api as unknown as SQLiteDatabase;
}

const FP_2_5 = makeVid(50, 2, 5);
const FP_2_8 = makeVid(50, 2, 8);
const FP_2_6 = makeVid(50, 2, 6);
const FP_2_7 = makeVid(50, 2, 7);
const DN_2_4 = makeVid(27, 2, 4);

let db: SQLiteDatabase;
let raw: DatabaseSync;

beforeEach(async () => {
  raw = new DatabaseSync(':memory:');
  db = adapt(raw);
  await migrateUserDb(db);
});

async function save(plan: MarkPlan) {
  return applyPlan(db, plan);
}
const addPlan = (add: NewMark[]): MarkPlan => ({ remove: [], add });
const hl = (startVid: number, endVid: number, color: NewMark['color'], now = 1): NewMark => ({ startVid, endVid, color, note: null, createdAt: now, updatedAt: now });

describe('banco do usuário', () => {
  it('migra uma vez: a segunda chamada não recria a tabela', async () => {
    await migrateUserDb(db);
    const version = raw.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(version.user_version).toBe(1);
    expect(await loadMarks(db)).toEqual([]);
  });

  it('rejeita a linha que é grifo e nota ao mesmo tempo, e a que não é nenhum dos dois', () => {
    expect(() => raw.exec("INSERT INTO marks (start_vid, end_vid, color, note, created_at, updated_at) VALUES (1,1,'verde','x',1,1)")).toThrow();
    expect(() => raw.exec("INSERT INTO marks (start_vid, end_vid, color, note, created_at, updated_at) VALUES (1,1,NULL,NULL,1,1)")).toThrow();
  });
});

describe('gravação de grifos e notas', () => {
  it('grifa, recorta o grifo antigo e desfaz voltando ao estado anterior (NT grego)', async () => {
    await save(addPlan([hl(FP_2_5, FP_2_8, 'azul')]));
    const before = await loadMarks(db);
    expect(before).toHaveLength(1);

    const plan = paintPlan(before, FP_2_6, FP_2_7, 'rosa', 50);
    const change = await save(plan);
    const after = await loadMarks(db);
    expect(after.map((m): [number, number, string | null] => [m.startVid, m.endVid, m.color]).sort((a, b) => a[0] - b[0])).toEqual([
      [FP_2_5, FP_2_5, 'azul'],
      [FP_2_6, FP_2_7, 'rosa'],
      [FP_2_8, FP_2_8, 'azul'],
    ]);

    await revertChange(db, change);
    const reverted = await loadMarks(db);
    expect(reverted).toEqual(before);
  });

  it('nota com texto, edição e apagar com Desfazer (AT hebraico)', async () => {
    const created = await save(addPlan([{ startVid: DN_2_4, endVid: DN_2_4, color: null, note: 'primeira', createdAt: 1, updatedAt: 1 }]));
    const [n] = created.added as Mark[];
    expect(n!.id).toBeGreaterThan(0);

    const edit = await save({ remove: [n!], add: [{ startVid: DN_2_4, endVid: DN_2_4, color: null, note: 'editada', createdAt: 1, updatedAt: 2 }] });
    expect((await loadMarks(db)).map((m) => m.note)).toEqual(['editada']);

    const del = await save({ remove: [edit.added[0]!], add: [] });
    expect(await loadMarks(db)).toEqual([]);
    await revertChange(db, del);
    expect((await loadMarks(db)).map((m) => m.note)).toEqual(['editada']);
  });

  it('a referência e as datas são as únicas colunas de referência: nada de texto da Bíblia', async () => {
    await save(addPlan([hl(FP_2_5, FP_2_8, 'verde', 7)]));
    const cols = raw.prepare('PRAGMA table_info(marks)').all().map((c) => (c as { name: string }).name);
    expect(cols).toEqual(['id', 'start_vid', 'end_vid', 'color', 'note', 'created_at', 'updated_at']);
  });
});
