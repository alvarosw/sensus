// Estado das marcas do aparelho: a lista inteira (são poucas linhas) e o Desfazer da última mudança. Todas as gravações
// passam por uma fila, para que duas toques seguidos não se misturem. O texto da Bíblia não passa por aqui.
import { create } from 'zustand';
import { openUserDb } from './user-db';
import { applyPlan, loadMarks, revertChange } from './marks-repo';
import { paintPlan, type Mark, type MarkChange, type MarkColor, type MarkPlan } from './marks-model';

export interface MarksState {
  loaded: boolean;
  marks: Mark[];
  /** Última mudança, para o Desfazer do aviso. Uma só: o aviso some depois de um toque. */
  undoable: MarkChange | null;
  load(): Promise<void>;
  /** Grifa [start, end] com a cor, ou apaga o grifo desse trecho (cor null). */
  paint(start: number, end: number, color: MarkColor | null): Promise<MarkChange>;
  /** Cria a nota do trecho, ou edita `existing`. Texto vazio apaga a nota (com Desfazer). */
  saveNote(start: number, end: number, text: string, existing?: Mark): Promise<MarkChange | null>;
  /** Apaga marcas (grifos ou notas) sem diálogo: quem chama oferece o Desfazer. */
  remove(marks: readonly Mark[]): Promise<MarkChange>;
  /** Muda a cor de um grifo. */
  setColor(mark: Mark, color: MarkColor): Promise<MarkChange>;
  undo(): Promise<void>;
}

let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
};

const without = (marks: readonly Mark[], ids: ReadonlySet<number>) => marks.filter((m) => !ids.has(m.id));

export const useMarksStore = create<MarksState>()((set, get) => {
  /** Grava o plano, atualiza a lista e guarda a mudança para o Desfazer. */
  const commit = (plan: MarkPlan) =>
    serial(async () => {
      const db = await openUserDb();
      const change = await applyPlan(db, plan);
      const removedIds = new Set(change.removed.map((m) => m.id));
      set((s) => ({ marks: [...without(s.marks, removedIds), ...change.added], undoable: change }));
      return change;
    });

  return {
    loaded: false,
    marks: [],
    undoable: null,

    load: () =>
      serial(async () => {
        if (get().loaded) return;
        const db = await openUserDb();
        const marks = await loadMarks(db);
        set({ marks, loaded: true });
      }),

    paint: (start, end, color) => commit(paintPlan(get().marks.filter((m) => m.color !== null), start, end, color, Date.now())),

    saveNote: (start, end, text, existing) => {
      const body = text.trim();
      const now = Date.now();
      if (body === '') {
        if (!existing) return Promise.resolve(null);
        return commit({ remove: [existing], add: [] });
      }
      if (existing) {
        const { id: _id, ...rest } = existing;
        return commit({ remove: [existing], add: [{ ...rest, note: body, updatedAt: now }] });
      }
      return commit({ remove: [], add: [{ startVid: start, endVid: end, color: null, note: body, createdAt: now, updatedAt: now }] });
    },

    remove: (marks) => commit({ remove: [...marks], add: [] }),

    setColor: (mark, color) => {
      const { id: _id, ...rest } = mark;
      return commit({ remove: [mark], add: [{ ...rest, color, updatedAt: Date.now() }] });
    },

    undo: () =>
      serial(async () => {
        const change = get().undoable;
        if (!change) return;
        const db = await openUserDb();
        await revertChange(db, change);
        const addedIds = new Set(change.added.map((m) => m.id));
        set((s) => ({ marks: [...without(s.marks, addedIds), ...change.removed], undoable: null }));
      }),
  };
});
