// Folha de estudo sobre o leitor: alturas closed / peek / half / full (tokens.detents), arrasto pela alça,
// escrim só em "full". Em peek mostra o que o banco tem (sem IA); em half/full, trilho de lentes + lentes
// numa única rolagem. Dirigida pelo estado (useStudy.detent / goToLens).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
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
import { detents, motion, radius, shadow, size, useTheme, type Detent } from '@/design';
import { useStudy } from '@/state/study';
import { useEdition } from '@/data/db-context';
import { StudyDataPrompt } from '@/data/StudyDataPrompt';
import { BACK_PRIORITY, useBackLayer } from '../common/back';
import { useReduceMotion } from '../common/hooks';
import { STUDY } from './strings';
import { SheetBody } from './SheetBody';
import { SheetHead } from './SheetHead';
import { StudyDataProvider, type Range } from './useStudyData';

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
  const edition = useEdition();
  const clearSelection = useStudy((s) => s.clearSelection);
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
  // Banco de leitura: sem comentários, léxico e referências. Só o convite para baixar os dados aparece.
  if (edition === 'reader') return <StudyDataPrompt onClose={clearSelection} />;
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
  const [railBoxH, setRailBoxH] = useState(0);
  const [mounted, setMounted] = useState(detent !== 'closed');

  const heights = useMemo(() => {
    // O espaço da barra de navegação (inset inferior) fica abaixo do trilho: o peek não pode terminar sob ela.
    const peek = sheetHeight('peek', avail, headH + peekContentH + railBoxH + insets.bottom);
    return { peek, half: sheetHeight('half', avail), full: sheetHeight('full', avail) };
  }, [avail, headH, peekContentH, railBoxH, insets.bottom]);

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

  // Com o chat aberto o arrasto da alça fica desligado: o gesto não pode capturar toques sobre o chat.
  const chatOpen = useStudy((s) => s.chatOpen);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!chatOpen)
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
    [chatOpen, commit, fullV, h, halfV, peekV, startH, startIdx],
  );

  const sheetStyle = useAnimatedStyle(() => ({ height: h.value }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(h.value, [halfV.value, fullV.value], [0, 1], 'clamp'),
  }));

  const open = detent === 'half' || detent === 'full';
  useBackLayer('sheet', active, clearSelection, BACK_PRIORITY.sheet);
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
                <SheetHead detent={detent} />
              </View>
            </GestureDetector>
            <SheetBody open={open} atFull={detent === 'full'} bottomInset={insets.bottom} onPeekLayout={setPeekContentH} onRailLayout={setRailBoxH} />
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
