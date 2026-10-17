// Leitor contínuo: lista virtualizada de capítulos (entre capítulos e livros), carregando os vizinhos
// ao rolar nos dois sentidos. Seleção por toque, alças arrastáveis, grego do TR sob a seleção, rolagem
// até o versículo ("ir para") e manutenção da seleção visível acima da folha de estudo.
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Platform, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ViewProps } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { BOOK_TABLE, hasEdition, makeVid, sourceLong, splitVid, type Token, type Vid } from '@sensus/core';
import { LinkButton, Txt, motion, useTheme, type Detent } from '@/design';
import { useRepo } from '@/data/db-context';
import { useStudy } from '@/state/study';
import { shortRef } from '../nav/abbrev';
import { readLastPosition, writeLastPosition } from '../nav/last-position';
import { ChapterBlock } from './ChapterBlock';
import { SelectionHandles } from './Handles';
import { TOTAL_CHAPTERS, chapterAt, loadChapter, vidChapterIndex, type ChapterData } from './chapters';
import { LINE, ReaderGeometry } from './geometry';
import { useReaderNav, type NavRequest } from './nav-store';
import { createLoadSequencer, mayAutoScroll, planNavigation } from './nav-sequencing';
import { READER } from './strings';
import { sheetCover } from './viewport';

interface Pending extends NavRequest {
  /** 'top' alinha ao topo (restaurar posição); 'comfort' deixa folga acima (ir para). */
  align: 'top' | 'comfort';
  /** Lista recém-remontada: aplica sem animação. */
  reset?: boolean;
  startedAt: number;
}

interface CellCtx {
  geo: ReaderGeometry;
  onCell: (idx: number, y: number) => void;
}
const CellContext = createContext<CellCtx | null>(null);

/** Célula da lista: informa o y do capítulo (coordenada do conteúdo) à geometria. */
function GeoCell({ item, onLayout, style, children }: ViewProps & { item: number; onLayout?: ViewProps['onLayout']; children?: ReactNode }) {
  const ctx = useContext(CellContext);
  return (
    <View
      ref={Platform.OS === 'web' ? (n) => ctx?.geo.setWebNode('cell', item, n as unknown as HTMLElement | null) : undefined}
      style={style}
      onLayout={(e: LayoutChangeEvent) => {
        onLayout?.(e);
        ctx?.geo.setCell(item, e.nativeEvent.layout.y);
        ctx?.onCell(item, e.nativeEvent.layout.y);
      }}
    >
      {children}
    </View>
  );
}

const EDGE_SCROLL = 10;
const EDGE_ZONE = 36;

export interface ReaderProps {
  /** Altura da área abaixo da barra superior (base das alturas da folha). */
  areaHeight: number;
}

export const Reader = memo(function Reader({ areaHeight }: ReaderProps) {
  const { c, scheme } = useTheme();
  const repo = useRepo();
  const params = useLocalSearchParams<{ start?: string; end?: string; go?: string }>();

  const textSource = useStudy((s) => s.textSource);
  const greekOn = useStudy((s) => s.greek);
  const selection = useStudy((s) => s.selection);
  const detent = useStudy((s) => s.detent);
  const jumpTarget = useStudy((s) => s.jumpTarget);
  const request = useReaderNav((s) => s.request);

  const geo = useMemo(() => new ReaderGeometry(), []);
  // Depuração na web (testes de tela): expõe a geometria e o estado compartilhado.
  if (Platform.OS === 'web') Object.assign(globalThis, { __geo: geo, __study: useStudy });
  useEffect(() => {
    geo.setWebScroll(() => (listRef.current?.getScrollableNode() as HTMLElement | null) ?? null);
  }, [geo]);
  const geoVersion = useSyncExternalStore(geo.subscribe, geo.getVersion, geo.getVersion);

  const listRef = useRef<FlatList<number>>(null);
  const rootRef = useRef<View>(null);
  const scroll = useSharedValue(0);
  const offsetRef = useRef(0);
  const [viewportH, setViewportH] = useState(0);
  const viewportRef = useRef(0);

  // ---- janela de capítulos carregados ----
  const [win, setWin] = useState<{ lo: number; hi: number; epoch: number } | null>(null);
  const winRef = useRef(win);
  winRef.current = win;
  const [chapters, setChapters] = useState<Record<number, ChapterData>>({});
  const [loadedSource, setLoadedSource] = useState(textSource);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);
  const sourceRef = useRef(textSource);
  const loadingEdge = useRef<{ prev: boolean; next: boolean }>({ prev: false, next: false });
  const anchorRef = useRef<{ idx: number; y: number; scroll: number } | null>(null);

  const pendingRef = useRef<Pending | null>(null);
  // Cargas da janela: a última vence (uma carga antiga que termina depois não sobrescreve a nova), e enquanto
  // uma navegação carrega, a lista visível ainda é a antiga: título e rolagem automática ficam parados.
  const [loads] = useState(createLoadSequencer);
  const loadingNav = useRef(false);
  // Rolagem de um pedido já aplicado que ainda acompanha o layout (ver o efeito de rolagem pendente).
  const settleRef = useRef<{ p: Pending; until: number } | null>(null);
  const [pendingTick, setPendingTick] = useState(0);
  const lastNavAt = useRef(0);
  const [flashVid, setFlashVid] = useState<Vid>(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPending = useCallback((p: Pending | null) => {
    pendingRef.current = p;
    setPendingTick((n) => n + 1);
  }, []);

  /** Recomeça a janela em `idx` (e o seguinte) e agenda a rolagem ao alvo. */
  const reset = useCallback(
    async (req: Omit<Pending, 'align' | 'startedAt'> & { align?: Pending['align'] }, source: string) => {
      const idx = vidChapterIndex(req.vid);
      const hi = Math.min(idx + 1, TOTAL_CHAPTERS - 1);
      const token = loads.begin();
      loadingNav.current = true;
      setHidden(true);
      try {
        const ds = await Promise.all([idx, ...(hi > idx ? [hi] : [])].map((i) => loadChapter(repo, source, i)));
        // Outro pedido começou depois deste: ele é que vale (não mexe em janela, rolagem nem erro).
        if (!loads.isCurrent(token)) return;
        sourceRef.current = source;
        setChapters(Object.fromEntries(ds.map((d) => [d.idx, d])));
        setLoadedSource(source);
        setWin((w) => ({ lo: idx, hi, epoch: (w?.epoch ?? 0) + 1 }));
        loadingEdge.current = { prev: false, next: false };
        setPending({ align: 'comfort', ...req, reset: true, startedAt: Date.now() });
        loadingNav.current = false;
        setError(null);
      } catch (e) {
        if (!loads.isCurrent(token)) return;
        loadingNav.current = false;
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [repo, setPending, loads],
  );

  // Abertura: ?start/&end (seleção + rolagem), ?go (versículo) ou a última posição lida.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const num = (s?: string) => (s && /^\d+$/.test(s) ? Number(s) : null);
      const s = num(params.start);
      const e = num(params.end);
      const g = num(params.go);
      if (s && s >= 1_000_001) {
        useStudy.getState().setSelection(s, e && e >= s ? e : s);
        return void reset({ id: 0, kind: 'verse', vid: s, animated: false, align: 'comfort' }, textSource);
      }
      if (g && g >= 1_000_001) return void reset({ id: 0, kind: 'verse', vid: g, animated: false, align: 'comfort' }, textSource);
      const last = await readLastPosition();
      const book = last && last.book >= 1 && last.book <= 66 ? last.book : 1;
      const chapter = last && last.chapter >= 1 && last.chapter <= (BOOK_TABLE[book - 1]?.chapters ?? 1) ? last.chapter : 1;
      if (last?.verse) void reset({ id: 0, kind: 'verse', vid: makeVid(book, chapter, last.verse), animated: false, align: 'top' }, textSource);
      else void reset({ id: 0, kind: 'chapter', vid: makeVid(book, chapter, 1), animated: false }, textSource);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troca de fonte do texto: recarrega a janela e volta ao mesmo versículo.
  useEffect(() => {
    if (!winRef.current || textSource === sourceRef.current) return;
    const w = winRef.current;
    const top = geo.firstVerseFrom(offsetRef.current) ?? makeVid(chapterAt(w.lo).book, chapterAt(w.lo).chapter, 1);
    void reset({ id: 0, kind: 'verse', vid: top, animated: false, align: 'top' }, textSource);
  }, [textSource, geo, reset]);

  const loadEdge = useCallback(
    async (dir: 'prev' | 'next') => {
      const w = winRef.current;
      if (!w || loadingEdge.current[dir]) return;
      // Durante uma navegação o leitor ainda não está na posição final: não carrega capítulos nas bordas
      // (carregar o anterior ao montar desloca a rolagem para o capítulo errado).
      const st = settleRef.current;
      if (pendingRef.current || (st && Date.now() < st.until)) return;
      const idx = dir === 'prev' ? w.lo - 1 : w.hi + 1;
      if (idx < 0 || idx >= TOTAL_CHAPTERS) return;
      loadingEdge.current[dir] = true;
      try {
        const d = await loadChapter(repo, sourceRef.current, idx);
        const cur = winRef.current;
        if (!cur || cur.epoch !== w.epoch) return;
        if (dir === 'prev' && Platform.OS === 'web') {
          // react-native-web não mantém a posição ao inserir acima: compensamos ao medir a célula.
          const y = geo.chapterTop(cur.lo);
          if (y != null) anchorRef.current = { idx: cur.lo, y, scroll: offsetRef.current };
        }
        setChapters((m) => ({ ...m, [idx]: d }));
        setWin(dir === 'prev' ? { ...cur, lo: idx } : { ...cur, hi: idx });
      } catch {
        // tenta de novo no próximo gatilho de rolagem
      } finally {
        loadingEdge.current[dir] = false;
      }
    },
    [repo, geo],
  );

  const onCell = useCallback((idx: number, y: number) => {
    const a = anchorRef.current;
    if (a && a.idx === idx && y !== a.y) {
      anchorRef.current = null;
      listRef.current?.scrollToOffset({ offset: Math.max(0, a.scroll + (y - a.y)), animated: false });
    }
  }, []);
  const cellCtx = useMemo<CellCtx>(() => ({ geo, onCell }), [geo, onCell]);

  // ---- navegação (livros, "ir para", jumpTarget) ----
  // Só consome o pedido quando a janela existe (antes disso ele fica na loja e é atendido ao montar o leitor).
  const ready = win !== null;
  useEffect(() => {
    if (!request || !ready) return;
    useReaderNav.getState().consume(request.id);
    const plan = planNavigation({
      targetIdx: vidChapterIndex(request.vid),
      win: winRef.current,
      hasChapter: geo.hasChapter(vidChapterIndex(request.vid)),
      sameSource: sourceRef.current === loadedSource,
    });
    if (plan === 'scroll') setPending({ ...request, align: 'comfort', startedAt: Date.now() });
    else void reset({ ...request, align: 'comfort' }, sourceRef.current);
  }, [request, geo, loadedSource, reset, setPending, ready]);

  useEffect(() => {
    if (jumpTarget == null) return;
    useStudy.getState().jumpTo(null);
    useReaderNav.getState().goVerse(jumpTarget, { flash: true });
  }, [jumpTarget]);

  const cover = sheetCover(detent, areaHeight);

  const flash = useCallback((vid: Vid) => {
    setFlashVid(vid);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashVid(0), motion.flash);
  }, []);
  useEffect(() => () => void (flashTimer.current && clearTimeout(flashTimer.current)), []);

  // Resolve a rolagem pendente assim que a geometria do alvo existe. Em listas recém-montadas o layout ainda
  // se ajusta (alturas reais), então acompanha o alvo por um instante até a geometria estabilizar.
  const computeOffset = useCallback(
    (p: Pending): number | null => {
      const idx = vidChapterIndex(p.vid);
      if (p.kind === 'chapter') {
        const top = geo.chapterTop(idx);
        const marker = geo.chapterMarkerTop(idx);
        if (top == null || marker == null) return null;
        return chapterAt(idx).chapter === 1 ? top : marker - 10;
      }
      const pt = geo.startOf(p.vid);
      if (!pt) return null;
      const lineTop = pt.y - LINE.baseline;
      const visible = Math.max(0, viewportRef.current - (p.align === 'top' ? 0 : cover));
      return lineTop - (p.align === 'top' ? 8 : Math.min(140, visible * 0.3));
    },
    [geo, cover],
  );
  useEffect(() => {
    const p = pendingRef.current;
    if (!p) {
      const st = settleRef.current;
      if (st && Date.now() < st.until) {
        const off = computeOffset(st.p);
        if (off != null && Math.abs(Math.max(0, off) - offsetRef.current) > 3) {
          lastNavAt.current = Date.now();
          listRef.current?.scrollToOffset({ offset: Math.max(0, off), animated: false });
        }
      }
      return;
    }
    const offset = computeOffset(p);
    if (offset == null) {
      if (Date.now() - p.startedAt > 2500) {
        pendingRef.current = null;
        setHidden(false);
      }
      return;
    }
    pendingRef.current = null;
    lastNavAt.current = Date.now();
    listRef.current?.scrollToOffset({ offset: Math.max(0, offset), animated: !!p.animated && !p.reset });
    if (p.reset) settleRef.current = { p, until: Date.now() + 1200 };
    setTimeout(() => setHidden(false), p.reset ? 350 : 0);
    if (p.flash && p.kind === 'verse') flash(p.vid);
  }, [geoVersion, pendingTick, computeOffset, flash]);

  // Segurança: se a geometria nunca chegar, mostra a lista mesmo assim.
  useEffect(() => {
    if (!hidden) return;
    const t = setTimeout(() => setHidden(false), 3000);
    return () => clearTimeout(t);
  }, [hidden, pendingTick]);

  // ---- título (posição) e última posição ----
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updatePosition = useCallback(() => {
    // Enquanto a navegação não foi aplicada (pendente ou ainda carregando), a posição lida é a da lista antiga:
    // não mexe no título, senão ele volta ao capítulo de origem logo depois de "ir para".
    if (pendingRef.current || loadingNav.current) return;
    const y = offsetRef.current;
    const list = geo.mountedChapters();
    if (list.length === 0) return;
    let cur = list[0]!;
    for (const idx of list) {
      const m = geo.chapterMarkerTop(idx);
      if (m != null && m - y < 70) cur = idx;
    }
    const { book, chapter } = chapterAt(cur);
    useReaderNav.getState().setPosition(book, chapter);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const v = geo.firstVerseFrom(offsetRef.current);
      if (v) {
        const p = splitVid(v);
        writeLastPosition({ book: p.book, chapter: p.chapter, verse: p.verse });
      }
    }, 700);
  }, [geo]);
  useEffect(() => () => void (persistTimer.current && clearTimeout(persistTimer.current)), []);
  useEffect(() => {
    if (win) updatePosition();
  }, [geoVersion, win, updatePosition]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      offsetRef.current = y;
      scroll.value = y;
      updatePosition();
    },
    [scroll, updatePosition],
  );

  // ---- seleção por toque ----
  const onVerse = useCallback((vid: Vid) => {
    const s = useStudy.getState();
    const sel = s.selection;
    if (sel && vid >= sel.start && vid <= sel.end) {
      if (sel.start === sel.end) {
        s.clearSelection();
        return;
      }
      s.tapVerse(vid);
      s.showToast({ text: READER.reduced(shortRef({ start: vid, end: vid })), actionLabel: READER.undo, onAction: () => useStudy.getState().undoSelection() });
      return;
    }
    s.tapVerse(vid);
  }, []);
  const onWord = useCallback((citeId: string) => useStudy.getState().pushPanel({ kind: 'word', tokenCiteId: citeId }), []);

  // ---- alças ----
  const [draft, setDraft] = useState<{ start: Vid; end: Vid } | null>(null);
  const draftRef = useRef<{ start: Vid; end: Vid } | null>(null);
  const dragRef = useRef<{ which: 'start' | 'end'; ox: number; oy: number; fx: number; fy: number; ready: boolean; timer: ReturnType<typeof setInterval> | null } | null>(null);
  const viewportBottomZone = useRef(0);
  viewportBottomZone.current = viewportH - cover;

  const applyDrag = useCallback(() => {
    const d = dragRef.current;
    const cur = draftRef.current;
    if (!d || !d.ready || !cur) return;
    const y = offsetRef.current + d.fy + (d.which === 'start' ? 14 : -14);
    const vid = geo.verseAt(d.fx, y);
    if (vid == null) return;
    let next = cur;
    if (d.which === 'start' && vid <= cur.end && vid !== cur.start) next = { start: vid, end: cur.end };
    if (d.which === 'end' && vid >= cur.start && vid !== cur.end) next = { start: cur.start, end: vid };
    if (next !== cur) {
      draftRef.current = next;
      setDraft(next);
    }
  }, [geo]);

  const onDragStart = useCallback(
    (which: 'start' | 'end') => {
      const sel = useStudy.getState().selection;
      if (!sel) return;
      dragRef.current?.timer && clearInterval(dragRef.current.timer);
      const d = { which, ox: 0, oy: 0, fx: 0, fy: 0, ready: false, timer: null as ReturnType<typeof setInterval> | null };
      dragRef.current = d;
      draftRef.current = { start: sel.start, end: sel.end };
      rootRef.current?.measureInWindow((x, y) => {
        d.ox = x;
        d.oy = y;
        d.ready = true;
      });
      d.timer = setInterval(() => {
        if (!d.ready) return;
        const zone = viewportBottomZone.current;
        let dy = 0;
        if (d.fy < EDGE_ZONE) dy = -EDGE_SCROLL;
        else if (d.fy > zone - EDGE_ZONE) dy = EDGE_SCROLL;
        if (dy === 0) return;
        const next = Math.max(0, offsetRef.current + dy);
        offsetRef.current = next;
        scroll.value = next;
        listRef.current?.scrollToOffset({ offset: next, animated: false });
        applyDrag();
      }, 16);
    },
    [applyDrag, scroll],
  );
  const onDrag = useCallback(
    (_which: 'start' | 'end', absX: number, absY: number) => {
      const d = dragRef.current;
      if (!d) return;
      d.fx = absX - d.ox;
      d.fy = absY - d.oy;
      applyDrag();
    },
    [applyDrag],
  );
  const onDragEnd = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    d.timer && clearInterval(d.timer);
    dragRef.current = null;
    const final = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    const sel = useStudy.getState().selection;
    if (final && sel && (final.start !== sel.start || final.end !== sel.end)) {
      useStudy.getState().setSelection(final.start, final.end, d.which === 'start' ? final.end : final.start);
    }
  }, []);
  useEffect(() => () => void (dragRef.current?.timer && clearInterval(dragRef.current.timer)), []);

  const shown = draft ?? (selection ? { start: selection.start, end: selection.end } : null);

  // ---- manter a seleção visível acima da folha (protótipo: keepSelectionVisible) ----
  const keepVisible = useCallback(
    (d: Detent): boolean => {
      const sel = useStudy.getState().selection;
      if (!sel) return true;
      const a = geo.startOf(sel.start);
      const b = geo.endOf(sel.end);
      if (!a || !b) return false;
      const top = a.y - LINE.baseline;
      const bottom = b.y - LINE.baseline + LINE.height;
      const st = offsetRef.current;
      const visible = viewportRef.current - sheetCover(d, areaHeight);
      if (top < st + 10 || top > st + visible - 60) {
        const span = bottom - top;
        const target = span < visible - 40 ? top - Math.max(16, (visible - span) / 2) : top - 16;
        listRef.current?.scrollToOffset({ offset: Math.max(0, target), animated: true });
      }
      return true;
    },
    [geo, areaHeight],
  );
  useEffect(() => {
    if (!selection || (detent !== 'peek' && detent !== 'half')) return;
    // Tenta por ~3 s: uma navegação entre livros pode levar mais que um ou dois ciclos para carregar.
    const MAX_TRIES = 25;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const run = () => {
      const ok = mayAutoScroll({
        dragging: !!dragRef.current,
        navPending: !!pendingRef.current,
        loadingNav: loadingNav.current,
        sinceNavMs: Date.now() - lastNavAt.current,
      });
      if (!ok) {
        if (++tries < MAX_TRIES) timer = setTimeout(run, 120);
        return;
      }
      if (!keepVisible(detent) && ++tries < MAX_TRIES) timer = setTimeout(run, 120);
    };
    timer = setTimeout(run, 60);
    return () => clearTimeout(timer);
  }, [detent, selection?.start, selection?.end, keepVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- grego do TR sob os versículos selecionados ----
  const [greekTokens, setGreekTokens] = useState<Record<number, Token[]> | null>(null);
  const committed = selection ? `${selection.start}-${selection.end}` : '';
  useEffect(() => {
    if (!greekOn || !selection) {
      setGreekTokens(null);
      return;
    }
    let alive = true;
    void repo
      .tokens({ start: selection.start, end: selection.end }, 'gnt')
      .then((all) => {
        if (!alive) return;
        const by: Record<number, Token[]> = {};
        for (const t of all) if (hasEdition(t, 'TR')) (by[t.vid] ??= []).push(t);
        setGreekTokens(by);
      })
      .catch(() => alive && setGreekTokens(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, greekOn, committed]);

  // ---- renderização ----
  const data = useMemo(() => {
    if (!win) return [];
    const out: number[] = [];
    for (let i = win.lo; i <= win.hi; i++) if (chapters[i]) out.push(i);
    return out;
  }, [win, chapters]);

  const sourceName = sourceLong(loadedSource);
  const extra = useMemo(
    () => ({ shown, greekTokens: greekOn ? greekTokens : null, flashVid, scheme, loadedSource }),
    [shown, greekOn, greekTokens, flashVid, scheme, loadedSource],
  );

  const renderItem = useCallback(
    ({ item }: { item: number }) => {
      const d = chapters[item];
      if (!d) return null;
      const s = extra.shown;
      const overlaps = s && s.start <= d.last && s.end >= d.first;
      let gk: Record<number, Token[]> | undefined;
      if (extra.greekTokens && overlaps) {
        for (const [k, v] of Object.entries(extra.greekTokens)) {
          const vid = Number(k);
          if (vid >= d.first && vid <= d.last) (gk ??= {})[vid] = v;
        }
      }
      return (
        <ChapterBlock
          data={d}
          geo={geo}
          sourceName={sourceName}
          selStart={overlaps ? Math.max(s.start, d.first) : 0}
          selEnd={overlaps ? Math.min(s.end, d.last) : 0}
          flashVid={extra.flashVid >= d.first && extra.flashVid <= d.last ? extra.flashVid : 0}
          greek={gk}
          onVerse={onVerse}
          onWord={onWord}
        />
      );
    },
    [chapters, extra, geo, sourceName, onVerse, onWord],
  );

  const footer = useMemo(
    () => (
      <View style={{ paddingBottom: sheetCover(detent, areaHeight) + 30 }}>
        {win && win.hi >= TOTAL_CHAPTERS - 1 ? (
          <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: c.border, marginTop: 18, marginHorizontal: 22 }}>
            <Txt v="meta" color="muted" center style={{ paddingTop: 24, paddingBottom: 8 }}>{READER.endOfBible}</Txt>
          </View>
        ) : (
          <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={c.muted} />
          </View>
        )}
      </View>
    ),
    [detent, areaHeight, win, c.border, c.muted],
  );

  const onRootLayout = useCallback((e: LayoutChangeEvent) => {
    viewportRef.current = e.nativeEvent.layout.height;
    setViewportH(e.nativeEvent.layout.height);
  }, []);

  return (
    <View ref={rootRef} testID="reader" onLayout={onRootLayout} style={{ flex: 1, backgroundColor: c.bg }}>
      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          <Txt v="body" color="muted" center>{READER.loadError}</Txt>
          <Txt v="bodySm" color="muted" center>{error}</Txt>
          <LinkButton label={READER.retry} onPress={() => { const n = useReaderNav.getState().position; void reset({ id: 0, kind: 'chapter', vid: makeVid(n.book, n.chapter, 1) }, textSource); }} />
        </View>
      ) : !win ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.muted} />
        </View>
      ) : (
        <CellContext.Provider value={cellCtx}>
          <FlatList
            ref={listRef}
            key={win.epoch}
            testID="reader-list"
            style={{ opacity: hidden ? 0 : 1 }}
            data={data}
            extraData={extra}
            keyExtractor={String}
            renderItem={renderItem}
            CellRendererComponent={GeoCell as never}
            onScroll={onScroll}
            onContentSizeChange={() => geo.invalidate()}
            scrollEventThrottle={16}
            onStartReached={() => void loadEdge('prev')}
            onStartReachedThreshold={1.2}
            onEndReached={() => void loadEdge('next')}
            onEndReachedThreshold={1.2}
            maintainVisibleContentPosition={Platform.OS === 'web' ? undefined : { minIndexForVisible: 0 }}
            initialNumToRender={2}
            windowSize={5}
            maxToRenderPerBatch={2}
            contentContainerStyle={{ paddingTop: 18 }}
            ListFooterComponent={footer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </CellContext.Provider>
      )}
      {win && !hidden && (
        <SelectionHandles geo={geo} selection={shown} scroll={scroll} viewportHeight={viewportH} onDragStart={onDragStart} onDrag={onDrag} onDragEnd={onDragEnd} />
      )}
    </View>
  );
});

