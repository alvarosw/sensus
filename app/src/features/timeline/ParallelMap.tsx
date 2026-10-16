// Faixa-mapa do paralelo: a extensão inteira com os pontos de cada linha e a janela visível. Arrastar move a janela;
// tocar fora dela a centraliza ali. Só a janela é tocável: o resto é visão geral.
import { useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { fontFamilies, useTheme } from '@/design';
import { clampView, yearText, type Bounds } from './model';
import { kindColor } from './parts';
import type { ChartLane } from './ParallelChart';
import { TL } from './strings';

const PADX = 6;
const TICK_H = 3;

export function ParallelMap({
  lanes,
  ext,
  view,
  onView,
}: {
  lanes: ChartLane[];
  ext: Bounds;
  view: Bounds;
  onView: (v: Bounds) => void;
}) {
  const { c, st } = useTheme();
  const [W, setW] = useState(0);
  const [H, setH] = useState(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ y0: number; lo: number; hi: number } | null>(null);

  const span = ext.hi - ext.lo || 1;
  const yAt = (px: number) => ext.lo + ((px - PADX) / Math.max(1, W - PADX * 2)) * span;
  const xAt = (year: number) => PADX + ((year - ext.lo) / span) * (W - PADX * 2);

  // Tocar (ou começar a arrastar) fora da janela centraliza a janela ali; depois o arrasto a acompanha.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      const y = yAt(e.x);
      let v = viewRef.current;
      if (y < v.lo || y > v.hi) {
        const s = v.hi - v.lo;
        v = clampView({ lo: y - s / 2, hi: y + s / 2 }, ext);
        onView(v);
      }
      drag.current = { y0: y, lo: v.lo, hi: v.hi };
    })
    .onUpdate((e) => {
      const d0 = drag.current;
      if (!d0) return;
      const d = yAt(e.x) - d0.y0;
      onView(clampView({ lo: d0.lo + d, hi: d0.hi + d }, ext));
    })
    .onFinalize(() => {
      drag.current = null;
    });

  const onLayout = (e: LayoutChangeEvent) => {
    setW(e.nativeEvent.layout.width);
    setH(e.nativeEvent.layout.height);
  };
  const a = xAt(view.lo);
  const b = xAt(view.hi);

  return (
    <GestureDetector gesture={pan}>
      <View testID="tl-map" onLayout={onLayout} accessible accessibilityRole="adjustable" accessibilityLabel={TL.mapLabel} style={{ height: 44, borderWidth: 1, borderColor: c.border, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface }}>
        {W > 0 && H > 0 && (
          <Svg width={W} height={H}>
            <Rect x={0} y={0} width={W} height={H} fill={c.surface} />
            {lanes.map((l, i) => {
              const cy = ((i + 0.5) * (H - 12)) / Math.max(1, lanes.length) + 6;
              const color = kindColor(l.line.kind, st);
              return l.visible.map((e) => (
                <Rect key={`${l.id}-${e.cite_id}`} x={xAt(e.sortKey) - 1} y={cy - 1.5} width={2} height={TICK_H} fill={color} />
              ));
            })}
            <Rect x={a} y={1} width={Math.max(4, b - a)} height={H - 2} fill={c.accent} opacity={0.12} />
            <Rect x={a} y={1} width={Math.max(4, b - a)} height={H - 2} fill="none" stroke={c.accent} strokeWidth={2} rx={3} />
            <SvgText x={6} y={H - 4} fill={c.muted} fontSize={9} fontFamily={fontFamilies.mono}>
              {yearText(ext.lo)}
            </SvgText>
            <SvgText x={W - 6} y={H - 4} fill={c.muted} fontSize={9} fontFamily={fontFamilies.mono} textAnchor="end">
              {yearText(ext.hi)}
            </SvgText>
          </Svg>
        )}
      </View>
    </GestureDetector>
  );
}
