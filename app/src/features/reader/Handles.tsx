// Alças de seleção (início e fim): ponto de destaque + haste, como no protótipo. Ficam numa camada sobre a
// lista (para não desmontarem ao rolar) e seguem a rolagem pelo valor compartilhado `scroll`.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { Vid } from '@sensus/core';
import { size, useTheme } from '@/design';
import { useStudy } from '@/state/study';
import { LINE, type ReaderGeometry } from './geometry';
import { READER } from './strings';

type Which = 'start' | 'end';

export interface HandlesProps {
  geo: ReaderGeometry;
  selection: { start: Vid; end: Vid } | null;
  scroll: SharedValue<number>;
  viewportHeight: number;
  onDragStart: (which: Which) => void;
  onDrag: (which: Which, absoluteX: number, absoluteY: number) => void;
  onDragEnd: (which: Which) => void;
}

const BOX = size.handle; // 22
const DOT = 14;
const STEM = LINE.glyphBottom - LINE.glyphTop + 2;

export function SelectionHandles(props: HandlesProps) {
  const { geo, selection } = props;
  const version = useSyncExternalStore(geo.subscribe, geo.getVersion, geo.getVersion);
  // A versão entra nas dependências de propósito: a geometria muda sem que as props mudem
  // (o compilador do React memoizaria a leitura só por `geo`/`selection`).
  const a = useMemo(() => (selection ? geo.startOf(selection.start) : null), [geo, selection?.start, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = useMemo(() => (selection ? geo.endOf(selection.end) : null), [geo, selection?.end, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!selection) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      {a && <Handle {...props} which="start" x={a.x} top={a.y - LINE.baseline + LINE.glyphTop - BOX} />}
      {b && <Handle {...props} which="end" x={b.x} top={b.y - LINE.baseline + LINE.glyphBottom} />}
    </View>
  );
}

function Handle({ which, x, top, scroll, viewportHeight, onDragStart, onDrag, onDragEnd }: HandlesProps & { which: Which; x: number; top: number }) {
  const { c } = useTheme();
  // Posição do conteúdo e altura da viewport em valores compartilhados: o estilo animado os relê sozinho.
  const topSV = useSharedValue(top);
  const heightSV = useSharedValue(viewportHeight);
  useEffect(() => {
    topSV.value = top;
    heightSV.value = viewportHeight;
  }, [top, viewportHeight, topSV, heightSV]);
  const style = useAnimatedStyle(() => {
    const y = topSV.value - scroll.value;
    return { transform: [{ translateY: y }], opacity: y > -BOX && y < heightSV.value ? 1 : 0 };
  });
  // Com o chat aberto a alça fica desligada: não pode capturar toques sobre o chat (que cobre o leitor).
  const chatOpen = useStudy((st) => st.chatOpen);
  const pan = Gesture.Pan()
    .enabled(!chatOpen)
    .runOnJS(true)
    .minDistance(0)
    .onBegin(() => onDragStart(which))
    .onUpdate((e) => onDrag(which, e.absoluteX, e.absoluteY))
    .onFinalize(() => onDragEnd(which));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        testID={`handle-${which}`}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={which === 'start' ? READER.handleStart : READER.handleEnd}
        hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
        style={[{ position: 'absolute', left: x - BOX / 2, top: 0, width: BOX, height: BOX, alignItems: 'center', justifyContent: 'center' }, style]}
      >
        <View
          style={{
            position: 'absolute',
            width: 2,
            height: STEM,
            backgroundColor: c.accent,
            left: BOX / 2 - 1,
            ...(which === 'start' ? { top: 18 } : { bottom: 18 }),
          }}
        />
        <View
          style={{
            width: DOT,
            height: DOT,
            borderRadius: DOT / 2,
            backgroundColor: c.accent,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 1.5,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          }}
        />
      </Animated.View>
    </GestureDetector>
  );
}
