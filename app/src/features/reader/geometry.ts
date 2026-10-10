// Geometria do leitor: onde cada versículo está, em coordenadas do conteúdo da lista.
// Cada capítulo (célula) informa seu y; cada trecho (run) seu y dentro da célula; cada marcador
// inline (início/fim de versículo) seu x/y dentro do texto. A soma dá a posição no conteúdo, sem medir
// de forma assíncrona. Alças, rolagem até o versículo e o mapeamento dedo → versículo usam isto.
import type { Vid } from '@sensus/core';
import { splitVid } from '@sensus/core';
import { Platform } from 'react-native';
import { chapterIndex } from './chapters';

/** Medidas da linha do texto bíblico (type.scripture): distância do topo/base da linha à linha de base. */
export const LINE = {
  height: 30,
  /** Linha de base abaixo do topo da linha. */
  baseline: 23,
  /** Área do glifo (alças: início sobe ao topo do glifo, fim desce à base), medida no Literata 17.5. */
  glyphTop: 23 - 21,
  glyphBottom: 23 + 5,
} as const;

interface Mark {
  idx: number;
  run: string;
  x: number;
  y: number;
}

export interface VersePoint {
  x: number;
  /** Linha de base (y no conteúdo). */
  y: number;
}

export class ReaderGeometry {
  private cellY = new Map<number, number>();
  private markerY = new Map<number, number>();
  private runY = new Map<string, number>();
  private starts = new Map<Vid, Mark>();
  private ends = new Map<Vid, Mark>();
  private mounted = new Set<number>();
  private subs = new Set<() => void>();
  private scheduled = false;
  private sorted: Array<{ vid: Vid; x: number; y: number }> | null = null;
  version = 0;

  // Web: react-native-web só dispara onLayout ao mudar o tamanho (não a posição), então a posição vem
  // sempre do DOM, relativa ao conteúdo rolável.
  private webScroll: (() => HTMLElement | null) | null = null;
  private web = { cell: new Map<number, HTMLElement>(), chapter: new Map<number, HTMLElement>(), start: new Map<Vid, HTMLElement>(), end: new Map<Vid, HTMLElement>() };
  private isWeb = Platform.OS === 'web';
  setWebScroll(get: () => HTMLElement | null): void {
    this.webScroll = get;
  }
  setWebNode(kind: 'cell' | 'chapter' | 'start' | 'end', key: number, node: HTMLElement | null): void {
    const m = this.web[kind] as Map<number, HTMLElement>;
    if (node) m.set(key, node);
    else m.delete(key);
    this.touch();
  }
  private webPos(node: HTMLElement | undefined): { x: number; y: number } | null {
    const sc = this.webScroll?.();
    if (!node || !sc) return null;
    const r = node.getBoundingClientRect();
    const sr = sc.getBoundingClientRect();
    return { x: r.left - sr.left, y: r.top - sr.top + sc.scrollTop };
  }
  /** Invalida leituras (ex.: o conteúdo mudou de tamanho). */
  invalidate(): void {
    this.touch();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  };
  getVersion = (): number => this.version;

  private touch(): void {
    this.sorted = null;
    if (this.scheduled) return;
    this.scheduled = true;
    setTimeout(() => {
      this.scheduled = false;
      this.version++;
      this.subs.forEach((f) => f());
    }, 0);
  }

  setCell(idx: number, y: number): void {
    if (this.cellY.get(idx) === y && this.mounted.has(idx)) return;
    this.cellY.set(idx, y);
    this.mounted.add(idx);
    this.touch();
  }
  clearCell(idx: number): void {
    this.mounted.delete(idx);
    this.touch();
  }
  setMarker(idx: number, y: number): void {
    if (this.markerY.get(idx) === y) return;
    this.markerY.set(idx, y);
    this.touch();
  }
  setRun(run: string, y: number): void {
    if (this.runY.get(run) === y) return;
    this.runY.set(run, y);
    this.touch();
  }
  removeRun(run: string): void {
    this.runY.delete(run);
    this.touch();
  }
  /** Só remove se a marca ainda pertence a este trecho (o versículo pode ter mudado de trecho). */
  removeMark(kind: 'start' | 'end', vid: Vid, run: string): void {
    const map = kind === 'start' ? this.starts : this.ends;
    if (map.get(vid)?.run !== run) return;
    map.delete(vid);
    this.touch();
  }
  setMark(kind: 'start' | 'end', vid: Vid, run: string, x: number, y: number): void {
    const map = kind === 'start' ? this.starts : this.ends;
    const cur = map.get(vid);
    if (cur && cur.run === run && cur.x === x && cur.y === y) return;
    map.set(vid, { idx: chapterIndex(splitVid(vid).book, Math.max(splitVid(vid).chapter, 1)), run, x, y });
    this.touch();
  }

  /** O capítulo está montado e medido. */
  hasChapter(idx: number): boolean {
    return this.isWeb ? this.web.cell.has(idx) : this.mounted.has(idx) && this.cellY.has(idx);
  }
  chapterTop(idx: number): number | null {
    if (this.isWeb) return this.webPos(this.web.cell.get(idx))?.y ?? null;
    return this.mounted.has(idx) ? (this.cellY.get(idx) ?? null) : null;
  }
  /** Topo do marcador de capítulo no conteúdo. */
  chapterMarkerTop(idx: number): number | null {
    if (this.isWeb) return this.webPos(this.web.chapter.get(idx))?.y ?? null;
    const c = this.chapterTop(idx);
    const m = this.markerY.get(idx);
    return c == null || m == null ? null : c + m;
  }
  mountedChapters(): number[] {
    return [...(this.isWeb ? this.web.cell.keys() : this.mounted)].sort((a, b) => a - b);
  }

  private at(m: Mark | undefined): VersePoint | null {
    if (!m) return null;
    const cell = this.cellY.get(m.idx);
    const run = this.runY.get(m.run);
    if (cell == null || run == null || !this.mounted.has(m.idx)) return null;
    // O marcador inline mede 1×1 e fica sobre a linha de base: o y dele é (linha de base − 1).
    return { x: m.x, y: cell + run + m.y + 1 };
  }
  startOf(vid: Vid): VersePoint | null {
    if (this.isWeb) return this.webMark(this.web.start.get(vid));
    return this.at(this.starts.get(vid));
  }
  endOf(vid: Vid): VersePoint | null {
    if (this.isWeb) return this.webMark(this.web.end.get(vid));
    return this.at(this.ends.get(vid));
  }
  private webMark(node: HTMLElement | undefined): VersePoint | null {
    const p = this.webPos(node);
    return p ? { x: p.x, y: p.y + 1 } : null;
  }

  /** Inícios de versículo montados, em ordem de leitura. */
  private list(): Array<{ vid: Vid; x: number; y: number }> {
    if (this.sorted && !this.isWeb) return this.sorted;
    const out: Array<{ vid: Vid; x: number; y: number }> = [];
    if (this.isWeb) {
      for (const vid of this.web.start.keys()) {
        const p = this.startOf(vid);
        if (p) out.push({ vid, x: p.x, y: p.y });
      }
    } else {
      for (const [vid, m] of this.starts) {
        const p = this.at(m);
        if (p) out.push({ vid, x: p.x, y: p.y });
      }
    }
    out.sort((a, b) => a.vid - b.vid);
    this.sorted = out;
    return out;
  }

  /** Versículo sob o ponto (x, y) do conteúdo: o último cujo início vem antes dele na ordem de leitura. */
  verseAt(x: number, y: number): Vid | null {
    const list = this.list();
    let found: Vid | null = null;
    for (const e of list) {
      const lineTop = e.y - LINE.baseline;
      const above = y >= lineTop + LINE.height;
      const sameLine = y >= lineTop && !above;
      if (above || (sameLine && e.x <= x)) found = e.vid;
      else if (y < lineTop) break;
    }
    return found ?? list[0]?.vid ?? null;
  }

  /** Primeiro versículo cujo início está em/abaixo de y. */
  firstVerseFrom(y: number): Vid | null {
    for (const e of this.list()) if (e.y >= y) return e.vid;
    return null;
  }
}
