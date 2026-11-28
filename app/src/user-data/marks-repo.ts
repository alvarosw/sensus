// Consultas e gravações das marcas no banco do usuário. Cada mudança é uma transação: tira as marcas do plano e põe as
// novas. `applyPlan` devolve a mudança com os ids dados pelo banco, e `revertChange` a desfaz (tira as postas, repõe as
// tiradas com o mesmo id).
import type { SQLiteDatabase } from 'expo-sqlite';
import { MARK_COLORS, type Mark, type MarkChange, type MarkColor, type MarkPlan, type NewMark } from './marks-model';

interface MarkRow {
  id: number;
  start_vid: number;
  end_vid: number;
  color: string | null;
  note: string | null;
  created_at: number;
  updated_at: number;
}

const COLUMNS = 'id, start_vid, end_vid, color, note, created_at, updated_at';

function fromRow(r: MarkRow): Mark {
  const color = MARK_COLORS.find((c) => c === r.color) ?? null;
  return { id: r.id, startVid: r.start_vid, endVid: r.end_vid, color: color as MarkColor | null, note: r.note, createdAt: r.created_at, updatedAt: r.updated_at };
}

export async function loadMarks(db: SQLiteDatabase): Promise<Mark[]> {
  const rows = await db.getAllAsync<MarkRow>(`SELECT ${COLUMNS} FROM marks ORDER BY id`);
  return rows.map(fromRow);
}

async function insertMark(db: SQLiteDatabase, m: NewMark, id?: number): Promise<number> {
  const params = [m.startVid, m.endVid, m.color, m.note, m.createdAt, m.updatedAt];
  if (id === undefined) {
    const r = await db.runAsync('INSERT INTO marks (start_vid, end_vid, color, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', params);
    return r.lastInsertRowId;
  }
  await db.runAsync('INSERT INTO marks (id, start_vid, end_vid, color, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, ...params]);
  return id;
}

/** Aplica um plano numa transação e devolve o que mudou, com os ids novos. */
export async function applyPlan(db: SQLiteDatabase, plan: MarkPlan): Promise<MarkChange> {
  const added: Mark[] = [];
  await db.withTransactionAsync(async () => {
    for (const m of plan.remove) await db.runAsync('DELETE FROM marks WHERE id = ?', [m.id]);
    for (const m of plan.add) {
      const id = await insertMark(db, m);
      added.push({ ...m, id });
    }
  });
  return { removed: plan.remove, added };
}

/** Desfaz uma mudança: tira as marcas que ela pôs e repõe as que tirou, com os mesmos ids. */
export async function revertChange(db: SQLiteDatabase, change: MarkChange): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const m of change.added) await db.runAsync('DELETE FROM marks WHERE id = ?', [m.id]);
    for (const m of change.removed) await insertMark(db, m, m.id);
  });
}
