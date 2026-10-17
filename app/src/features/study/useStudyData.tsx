// Dados da folha de estudo: painel da seleção, painel da perícope (contexto da IA), bordas do trecho e rótulos.
// Uma instância vive em <StudySheet/> (StudyDataProvider) e chega às lentes por contexto. A IA (resumo, Detalhar,
// perguntas) está em useStudyAi.tsx e é montada aqui, no mesmo provedor.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { splitVid, wordKey, type Book, type PanelData, type Repo, type Vid } from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { useStudy, LENS_KEYS } from '@/state/study';
import { AiCtx, DataCtx } from './study-context';
import type { Range, RangeEdges, StudyAi, StudyData } from './study-state';
import { useBooks } from './useBooks';
import { useStudyAiFeed } from './useStudyAi';
import { usePassagePanel } from './usePassagePanel';

export { useStudyData, useStudyAi } from './study-context';
export type { AiStatus, DeepView, Range, RangeEdges, StudyAi, StudyData } from './study-state';

/** Último versículo do livro (para "+ prev" quando a seleção começa no primeiro versículo de um livro). */
async function lastVerseOf(repo: Repo, src: string, book: number, books: readonly Book[]): Promise<Vid | null> {
  const b = books.find((x) => x.num === book);
  if (!b) return null;
  return (await repo.chapter(src, book, b.chapters)).at(-1)?.vid ?? null;
}

/** Primeiro versículo do livro (para "+ next" quando a seleção termina no último versículo de um livro). */
async function firstVerseOf(repo: Repo, src: string, book: number, books: readonly Book[]): Promise<Vid | null> {
  if (!books.some((x) => x.num === book)) return null;
  return (await repo.chapter(src, book, 1))[0]?.vid ?? null;
}

/** Contagem e vizinhos da seleção, direto do banco. Os vizinhos atravessam o livro (ex.: Cl 1:1 → Fp 4:23). */
function useRangeEdges(range: Range, textSource: string, books: readonly Book[]): RangeEdges | null {
  const repo = useRepo();
  const key = `${textSource}:${range.start}-${range.end}:${books.length}`;
  const [state, setState] = useState<{ key: string; edges: RangeEdges } | null>(null);
  useEffect(() => {
    let alive = true;
    const src = textSource === 'kjv' ? 'kjv' : 'blivre';
    (async () => {
      const first = splitVid(range.start).book;
      const last = splitVid(range.end).book;
      const [inside, before, after] = await Promise.all([
        repo.verseTexts(src, range),
        repo.neighbors(src, { start: range.start, end: range.start }, 1),
        repo.neighbors(src, { start: range.end, end: range.end }, 1),
      ]);
      const prev = before.before.at(-1)?.vid ?? (await lastVerseOf(repo, src, first - 1, books));
      const next = after.after[0]?.vid ?? (await firstVerseOf(repo, src, last + 1, books));
      return { count: inside.length > 0 ? inside.length : null, prev: prev ?? null, next: next ?? null };
    })().then(
      (edges) => alive && setState({ key, edges }),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [repo, key, range, textSource, books]);
  return state?.key === key ? state.edges : null;
}

export function StudyDataProvider({ range, children }: { range: Range; children: ReactNode }) {
  const { data, ai } = useBuildStudyData(range);
  return (
    <DataCtx.Provider value={data}>
      <AiCtx.Provider value={ai}>{children}</AiCtx.Provider>
    </DataCtx.Provider>
  );
}

// ---- núcleo --------------------------------------------------------------------------------------

/** Perícopes muito longas (livro sem divisões) viram a própria seleção, para não montar o livro inteiro. */
function effectiveUnit(unit: Range | null, sel: Range): Range | null {
  if (!unit) return null;
  const a = splitVid(unit.start);
  const b = splitVid(unit.end);
  // Estimativa de versículos (~30 por capítulo); acima do limite o contexto da IA ficaria enorme.
  const approx = (b.chapter - a.chapter) * 30 + (b.verse - a.verse) + 1;
  if (a.book !== b.book || approx > MAX_UNIT_VERSES) return sel;
  return unit;
}

const MAX_UNIT_VERSES = 45;

function useBuildStudyData(range: Range): { data: StudyData; ai: StudyAi } {
  const books = useBooks();
  const textSource = useStudy((s) => s.textSource);

  const sel = usePassagePanel(range);
  // Mantém o painel anterior enquanto o novo carrega (evita piscar ao ajustar a seleção).
  const lastPanel = useRef<PanelData | null>(null);
  if (sel.panel) lastPanel.current = sel.panel;
  const panel = sel.panel ?? (sel.loading ? lastPanel.current : null);

  const unitRange = useMemo(() => effectiveUnit(sel.unit, range), [sel.unit, range]);
  // O painel da perícope é preparado já no "espiar"; só a IA espera a folha abrir.
  const unitPanel = usePassagePanel(unitRange);

  // Falha de carga (ex.: banco ainda abrindo): uma nova tentativa automática; depois, o botão "Tentar novamente".
  const autoRetried = useRef<string | null>(null);
  useEffect(() => {
    const id = `${range.start}-${range.end}`;
    if (!sel.error || autoRetried.current === id) return;
    autoRetried.current = id;
    const t = setTimeout(sel.reload, 1200);
    return () => clearTimeout(t);
  }, [sel.error, sel.reload, range.start, range.end]);

  const edges = useRangeEdges(range, textSource, books);
  const ai = useStudyAiFeed(range, unitRange, unitPanel);

  const tokenByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of panel?.layers.text.original ?? []) {
      const k = wordKey(t.surface);
      if (k && !m.has(k)) m.set(k, t.cite_id);
    }
    return m;
  }, [panel]);

  const allBooks = books.length > 0 ? books : sel.books;
  const loading = sel.loading && !panel;
  const citeIndex = sel.richCtx?.citeIndex;
  const labelOf = useCallback((id: string) => citeIndex?.get(id)?.label ?? id, [citeIndex]);
  const data = useMemo<StudyData>(
    () => ({ range, books: allBooks, panel, loading, error: sel.error, reload: sel.reload, unit: sel.unit, tokenByKey, textSource, edges, labelOf }),
    [range, allBooks, panel, loading, sel.error, sel.reload, sel.unit, tokenByKey, textSource, edges, labelOf],
  );
  return { data, ai };
}

export { LENS_KEYS };
