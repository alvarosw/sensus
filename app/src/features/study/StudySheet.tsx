// Folha de estudo sobre o leitor: alturas closed / peek / half / full (tokens.detents), arrasto pela alça,
// escrim só em "full". Em peek mostra o que o banco tem (sem IA); em half/full, trilho de lentes + lentes
// numa única rolagem. Dirigida pelo estado (useStudy.detent / goToLens).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Fact,
  IconButton,
  Pill,
  QuickAction,
  Tag,
  Txt,
  detents,
  gutter,
  motion,
  radius,
  shadow,
  size,
  space,
  useTheme,
  type Detent,
} from '@/design';
import { LENS_KEYS, LENS_LABELS, useStudy, type LensKey } from '@/state/study';
import { useReduceMotion } from '../common/hooks';
import { chv, keyWordsOf, refShort, refTitle, sourceLabel } from './format';
import { LENS_VIEWS } from './lenses';
import { STUDY } from './strings';
import { StudyDataProvider, useStudyData, type Range } from './useStudyData';
import { splitVid, variantSites, commentatorName } from '@sensus/core';

export interface StudySheetProps {
  /** Altura ocupada acima da área da folha, descontada das alturas. Padrão: área segura + barra superior (a folha é montada em tela cheia sobre o leitor). */
  topInset?: number;
}

/** Altura da folha em px para uma altura-alvo, dada a área disponível. */
export function sheetHeight(detent: Detent, available: number, peekMin = 0): number {
  if (detent === 'closed') return 0;
  const base = Math.round(available * detents[detent]);
  return detent === 'peek' ? Math.max(base, Math.min(peekMin, Math.round(available * 0.45))) : base;
}

const ORDER = ['peek', 'half', 'full'] as const;

export function StudySheet({ topInset }: StudySheetProps): ReactElement | null {
  const insets = useSafeAreaInsets();
  const selection = useStudy((s) => s.selection);
  const detent = useStudy((s) => s.detent);
  const start = selection?.start ?? null;
  const end = selection?.end ?? null;
  const range = useMemo<Range | null>(() => (start !== null && end !== null ? { start, end } : null), [start, end]);
  // Último intervalo: a folha continua desenhada enquanto desce ao fechar.
  const lastRange = useRef<Range | null>(null);
  if (range) lastRange.current = range;
  const shown = range ?? lastRange.current;
  if (!shown) return null;
  return (
    <StudyDataProvider range={shown}>
      <Sheet topInset={topInset ?? insets.top + size.topBar} active={!!range && detent !== 'closed'} />
    </StudyDataProvider>
  );
}

// ---- folha -----------------------------------------------------------------------------------------

function Sheet({ topInset, active }: { topInset: number; active: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const store = useStudy;
  const detent = useStudy((s) => s.detent);
  const setDetent = useStudy((s) => s.setDetent);
  const clearSelection = useStudy((s) => s.clearSelection);

  const [avail, setAvail] = useState(0);
  const [headH, setHeadH] = useState(0);
  const [peekContentH, setPeekContentH] = useState(0);
  const [mounted, setMounted] = useState(detent !== 'closed');

  const heights = useMemo(() => {
    const peek = sheetHeight('peek', avail, headH + peekContentH);
    return { peek, half: sheetHeight('half', avail), full: sheetHeight('full', avail) };
  }, [avail, headH, peekContentH]);

  const h = useSharedValue(0);
  const startH = useSharedValue(0);
  const startIdx = useSharedValue(0);
  const peekV = useSharedValue(0);
  const halfV = useSharedValue(0);
  const fullV = useSharedValue(0);
  useEffect(() => {
    peekV.value = heights.peek;
    halfV.value = heights.half;
    fullV.value = heights.full;
  }, [heights, peekV, halfV, fullV]);

  const target = (d: Detent): number => (d === 'closed' ? 0 : heights[d]);
  const animateTo = useCallback(
    (d: Detent) => {
      const to = target(d);
      const dur = reduce ? 0 : motion.sheet;
      if (d === 'closed') {
        h.value = withTiming(0, { duration: dur, easing: Easing.bezier(...motion.easing) }, (done) => {
          if (done) runOnJS(setMounted)(false);
        });
      } else {
        setMounted(true);
        h.value = withTiming(to, { duration: dur, easing: Easing.bezier(...motion.easing) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heights, reduce],
  );

  useEffect(() => {
    if (avail === 0) return;
    animateTo(active ? detent : 'closed');
  }, [detent, active, avail, animateTo]);

  const commit = useCallback(
    (idx: number) => {
      if (idx < 0) {
        clearSelection();
        return;
      }
      const d = ORDER[idx]!;
      if (store.getState().detent === d) animateTo(d);
      else setDetent(d);
    },
    [animateTo, clearSelection, setDetent, store],
  );

  useEffect(() => {
    startIdx.value = Math.max(0, ORDER.indexOf(detent as (typeof ORDER)[number]));
  }, [detent, startIdx]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .onStart(() => {
          'worklet';
          cancelAnimation(h);
          startH.value = h.value;
        })
        .onUpdate((e) => {
          'worklet';
          h.value = Math.max(0, Math.min(fullV.value, startH.value - e.translationY));
        })
        .onEnd((e) => {
          'worklet';
          const cur = h.value;
          const vUp = -e.velocityY / 1000;
          const hs = [peekV.value, halfV.value, fullV.value];
          let best = 0;
          for (let i = 1; i < 3; i++) if (Math.abs(hs[i]! - cur) < Math.abs(hs[best]! - cur)) best = i;
          if (vUp > 0.6) best = Math.min(2, startIdx.value + 1);
          else if (vUp < -0.6) best = startIdx.value === 0 ? 0 : startIdx.value - 1;
          if (cur < peekV.value * 0.55) best = -1;
          runOnJS(commit)(best);
        }),
    [commit, fullV, h, halfV, peekV, startH, startIdx],
  );

  const sheetStyle = useAnimatedStyle(() => ({ height: h.value }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(h.value, [halfV.value, fullV.value], [0, 1], 'clamp'),
  }));

  const open = detent === 'half' || detent === 'full';
  const onContainerLayout = (e: LayoutChangeEvent) => setAvail(Math.max(0, e.nativeEvent.layout.height - topInset));

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={onContainerLayout}>
      <Animated.View
        pointerEvents={detent === 'full' && active ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, zIndex: 6 }, scrimStyle]}
      >
        <Pressable testID="sheet-scrim" accessibilityLabel="Voltar para a meia altura" style={StyleSheet.absoluteFill} onPress={() => setDetent('half')} />
      </Animated.View>
      {mounted && avail > 0 && (
        <Animated.View
          testID="sheet"
          accessibilityLabel={STUDY.sheet}
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 7,
              backgroundColor: c.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              ...shadow.sheet,
            },
            sheetStyle,
          ]}
        >
          <View style={{ flex: 1, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, overflow: 'hidden' }}>
            <View testID={`sheet-detent-${detent}`} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} pointerEvents="none" />
            <GestureDetector gesture={pan}>
              <View onLayout={(e) => setHeadH(e.nativeEvent.layout.height)} style={Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'grab' } as object) : undefined}>
                <Grab onPress={() => setDetent(detent === 'peek' ? 'half' : detent === 'half' ? 'full' : 'half')} />
                <Head detent={detent} />
              </View>
            </GestureDetector>
            <SheetBody open={open} bottomInset={insets.bottom} onPeekLayout={(hh) => setPeekContentH(hh)} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function Grab({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID="sheet-grab"
      accessibilityRole="button"
      accessibilityLabel="Alternar altura do estudo"
      onPress={onPress}
      style={{ height: size.handle, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: c.border }} />
    </Pressable>
  );
}

// ---- cabeçalho -------------------------------------------------------------------------------------------

function Head({ detent }: { detent: Detent }) {
  const { range, books, panel, textSource } = useStudyData();
  const setDetent = useStudy((s) => s.setDetent);
  const clearSelection = useStudy((s) => s.clearSelection);
  const title = refTitle(range.start, range.end, books);
  const a = splitVid(range.start);
  const b = splitVid(range.end);
  const count = useMemo(() => {
    if (panel) {
      const set = new Set(panel.layers.text.translations.filter((v) => v.vid >= range.start && v.vid <= range.end).map((v) => v.vid));
      if (set.size > 0) return set.size;
    }
    return a.book === b.book && a.chapter === b.chapter ? b.verse - a.verse + 1 : null;
  }, [panel, range, a.book, a.chapter, b.book, b.chapter, b.verse]);
  const crosses = a.book === b.book && a.chapter !== b.chapter;

  return (
    <View style={{ paddingHorizontal: gutter.sheet, paddingBottom: space[4], flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="sheetTitle" testID="sheet-title" numberOfLines={2}>{title}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {count !== null && (
            <Txt v="meta" color="muted" style={{ fontWeight: '400' }}>{`${count} ${count === 1 ? STUDY.verse : STUDY.verses}`}</Txt>
          )}
          {crosses && <Tag tone="tint" label={STUDY.crosses(String(a.chapter), String(b.chapter))} />}
          <Txt v="meta" color="muted">{`· ${sourceLabel(textSource)}`}</Txt>
        </View>
      </View>
      <IconButton
        testID="sheet-expand"
        icon={detent === 'peek' ? 'chevronUp' : 'chevronDown'}
        label={detent === 'peek' ? STUDY.expand : STUDY.collapse}
        onPress={() => setDetent(detent === 'peek' ? 'half' : 'peek')}
      />
      <IconButton testID="sheet-close" icon="close" label={STUDY.close} onPress={clearSelection} />
    </View>
  );
}

// ---- corpo rolável ------------------------------------------------------------------------------------------

function SheetBody({ open, bottomInset, onPeekLayout }: { open: boolean; bottomInset: number; onPeekLayout: (h: number) => void }) {
  const lensTarget = useStudy((s) => s.lensTarget);
  const consume = useStudy((s) => s.consumeLensTarget);
  const setLens = useStudy((s) => s.setLens);
  const scroll = useRef<ScrollView>(null);
  // Alturas das lentes (o onLayout da web só avisa mudança de tamanho, não de posição): y = soma das anteriores.
  const lensH = useRef<Partial<Record<LensKey, number>>>({});
  const yOf = useCallback((k: LensKey): number | undefined => {
    let y = 0;
    for (const key of LENS_KEYS) {
      if (key === k) return lensH.current[key] === undefined ? undefined : y;
      const h = lensH.current[key];
      if (h === undefined) return undefined;
      y += h;
    }
    return undefined;
  }, []);
  const peekH = useRef(0);
  const railH = useRef(0);
  const [layoutTick, setLayoutTick] = useState(0);
  const current = useRef<LensKey>(useStudy.getState().lens);

  const scrollToLens = useCallback((k: LensKey, animated = true) => {
    const y = yOf(k);
    if (y === undefined) return false;
    // Filhos empilhados: espiar, trilho (fixo), lentes. (Na web cada filho ganha um invólucro, então não usamos o y do contêiner.)
    scroll.current?.scrollTo({ y: Math.max(0, peekH.current + y + 2), animated });
    return true;
  }, [yOf]);

  useEffect(() => {
    if (!lensTarget || !open) return;
    const t = setTimeout(() => {
      if (scrollToLens(lensTarget)) consume();
    }, 60);
    return () => clearTimeout(t);
  }, [lensTarget, open, layoutTick, scrollToLens, consume]);

  // Ao voltar para "espiar" a rolagem recomeça do topo.
  useEffect(() => {
    if (!open) scroll.current?.scrollTo({ y: 0, animated: false });
  }, [open]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y + 40;
      let cur: LensKey = 'visao';
      for (const k of LENS_KEYS) {
        const ly = yOf(k);
        if (ly !== undefined && peekH.current + ly <= y) cur = k;
      }
      if (cur !== current.current) {
        current.current = cur;
        if (!useStudy.getState().lensTarget) setLens(cur);
      }
    },
    [setLens, yOf],
  );

  const registerLens = (k: LensKey) => (e: LayoutChangeEvent) => {
    lensH.current[k] = e.nativeEvent.layout.height;
    setLayoutTick((n) => n + 1);
  };

  return (
    <ScrollView
      ref={scroll}
      testID="sheet-scroll"
      style={{ flex: 1 }}
      scrollEnabled={open}
      stickyHeaderIndices={open ? [1] : undefined}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={32}
      onScroll={onScroll}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      contentContainerStyle={{ paddingBottom: open ? 40 + bottomInset : 0 }}
    >
      <PeekContent
        onLayout={(e) => {
          peekH.current = e.nativeEvent.layout.height;
          onPeekLayout(peekH.current);
        }}
      />
      {open ? <Rail railHeight={(h) => (railH.current = h)} /> : <View />}
      {open ? (
        <View>
          {LENS_KEYS.map((k) => {
            const View_ = LENS_VIEWS[k];
            return <View_ key={k} onLayout={registerLens(k)} />;
          })}
        </View>
      ) : (
        <View />
      )}
    </ScrollView>
  );
}

// ---- "espiar": escopo, fatos, ações rápidas ---------------------------------------------------------------------

function PeekContent({ onLayout }: { onLayout: (e: LayoutChangeEvent) => void }) {
  const { range, books, panel, unit } = useStudyData();
  const setSelection = useStudy((s) => s.setSelection);
  const goToLens = useStudy((s) => s.goToLens);
  const openChat = useStudy((s) => s.openChat);
  const showToast = useStudy((s) => s.showToast);

  const prev = useMemo(() => panel?.layers.literary.before.filter((v) => v.vid < range.start).at(-1)?.vid ?? null, [panel, range]);
  const next = useMemo(() => panel?.layers.literary.after.find((v) => v.vid > range.end)?.vid ?? null, [panel, range]);
  const whole = !!unit && unit.start === range.start && unit.end === range.end;

  const facts = useMemo(() => {
    if (!panel) return null;
    const coms = panel.layers.interpretation.commentaries.filter((c) => c.start_vid % 1000 !== 0 && c.end_vid % 1000 !== 0);
    const authors = new Set(coms.map((c) => commentatorName(panel.sources[c.source_id], c)));
    const sites = variantSites(panel.layers.text.original);
    const words = keyWordsOf(panel);
    const hapax = words.find((w) => w.count === 1);
    const top = hapax ?? words[0];
    return { authors: authors.size, variants: sites.length, xrefs: panel.layers.intertext.xrefs.length, word: top, hapax: !!hapax };
  }, [panel]);

  return (
    <View onLayout={onLayout}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: gutter.sheet, paddingBottom: 10 }}>
        {prev !== null && <Pill testID="scope-prev" label={`+ ${chv(prev)}`} onPress={() => setSelection(prev, range.end, range.start)} />}
        {unit && !whole ? (
          <Pill
            testID="scope-unit"
            variant="suggest"
            label={STUDY.pericope(refShort(unit.start, unit.end, books))}
            onPress={() => {
              setSelection(unit.start, unit.end);
              showToast({ text: STUDY.pericopeExpanded(refShort(unit.start, unit.end, books, true)) });
            }}
          />
        ) : unit ? (
          <Pill variant="dashed" label={STUDY.pericopeWhole} />
        ) : null}
        {next !== null && <Pill testID="scope-next" label={`+ ${chv(next)}`} onPress={() => setSelection(range.start, next, range.start)} />}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: gutter.sheet, paddingBottom: 10 }} style={{ flexGrow: 0 }}>
        {facts ? (
          <>
            <Fact testID="fact-interpretacao" value={facts.authors} label={STUDY.factComentaristas} onPress={() => goToLens('interpretacao')} />
            <Fact testID="fact-texto" value={facts.variants} label={facts.variants === 1 ? STUDY.factVariante : STUDY.factVariantes} onPress={() => goToLens('texto')} />
            <Fact testID="fact-intertexto" value={facts.xrefs} label={STUDY.factXrefs} onPress={() => goToLens('intertexto')} />
            {facts.word && (
              <Fact
                testID="fact-lingua"
                greek
                value={facts.word.lexicon?.lemma ?? facts.word.token.lemma ?? facts.word.token.surface}
                label={facts.hapax ? (facts.word.strongBase.startsWith('H') ? STUDY.factHapaxOt : STUDY.factHapax) : STUDY.factVv(facts.word.count, facts.word.strongBase.startsWith('H'))}
                onPress={() => goToLens('lingua')}
              />
            )}
          </>
        ) : (
          [0, 1, 2].map((i) => <View key={i} style={{ width: 96, height: 44, borderRadius: radius.lg, opacity: 0.5 }} />)
        )}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: gutter.sheet, paddingBottom: 14 }}>
        <QuickAction testID="qa-visao" primary label={STUDY.qaStudy} onPress={() => goToLens('visao')} />
        <QuickAction testID="qa-lingua" label={STUDY.qaWords} onPress={() => goToLens('lingua')} />
        <QuickAction testID="qa-texto" label={STUDY.qaCompare} onPress={() => goToLens('texto')} />
        <QuickAction testID="qa-ask" label={STUDY.qaAsk} onPress={() => openChat()} />
      </View>
    </View>
  );
}

// ---- trilho de lentes -------------------------------------------------------------------------------------------------

function Rail({ railHeight }: { railHeight: (h: number) => void }) {
  const { c } = useTheme();
  const lens = useStudy((s) => s.lens);
  const goToLens = useStudy((s) => s.goToLens);
  const strip = useRef<ScrollView>(null);
  const xs = useRef<Partial<Record<LensKey, number>>>({});

  useEffect(() => {
    const x = xs.current[lens];
    if (x !== undefined) strip.current?.scrollTo({ x: Math.max(0, x - 40), animated: true });
  }, [lens]);

  return (
    <View
      onLayout={(e) => railHeight(e.nativeEvent.layout.height)}
      accessibilityLabel={STUDY.railLabel}
      style={{ backgroundColor: c.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border }}
    >
      <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingHorizontal: 12, paddingVertical: 8 }}>
        {LENS_KEYS.map((k) => {
          const on = k === lens;
          return (
            <Pressable
              key={k}
              testID={`rail-${k}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onLayout={(e) => (xs.current[k] = e.nativeEvent.layout.x)}
              onPress={() => goToLens(k)}
              style={{ borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: on ? c.chip : 'transparent' }}
            >
              <Txt v="button" tint={on ? c.accent : c.muted} style={{ fontSize: 12.5 }}>{LENS_LABELS[k]}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
