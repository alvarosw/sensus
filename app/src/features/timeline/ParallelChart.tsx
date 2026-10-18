// Gráfico do paralelo (SVG): uma faixa por linha com nome e contagem sobre o gráfico, títulos dos eventos quando há
// espaço, selo "N longe" (eventos isolados fora do núcleo), eixo de anos e eras ao fundo. Gestos: arrastar, pinça,
// toque duplo (2×) e toque (ponto → prévia; fora dos pontos → cursor de ano). Sem animação: vale para "reduzir movimento".
import { useRef, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { TIMELINE_ERAS, type NameFields, type TimelineLine, type TimelineLineEvent } from '@sensus/core';
import { fontFamilies, useTheme } from '@/design';
import type { TitledEvent } from '@/translate/timeline-translate';
import { clampView, tickStep, xOfYear, yearAtX, yearText, zoomView, type Bounds } from './model';
import { kindColor } from './parts';

/** Uma faixa já pronta para desenhar (ver ParallelView: eventos visíveis e selo). */
export interface ChartLane {
  id: string;
  line: TimelineLine;
  /** Eventos que aparecem (o núcleo, ou todos quando os distantes foram incluídos). */
  visible: TimelineLineEvent[];
  /** Eventos no total da linha (para o rótulo "nome · N"). */
  total: number;
  /** Anos dos eventos isolados que ficaram de fora (selo "longe"). Vazio quando incluídos. */
  far: number[];
}

/** Margem lateral, espaço do eixo, altura mínima e máxima de cada faixa, e a área de toque (px). */
const PADX = 10;
const TOP = 26;
const LANE_MIN = 44;
const LANE_MAX = 120;
const HIT_X = 10;
const HIT_Y = 14;
/** Títulos acima dos pontos só quando a faixa é alta o bastante. */
const TITLE_MIN_LANE = 52;
const TITLE_CHARS = 24;
/** Largura estimada de um caractere de rótulo (px), para não medir texto no aparelho. */
const CHAR_W = 6;

export interface ChartProps {
  lanes: ChartLane[];
  ext: Bounds;
  view: Bounds;
  cursor: number | null;
  favEvents: ReadonlySet<string>;
  /** Título do evento a mostrar (pt quando existe; senão, tradução quando configurada). */
  trTitle: (event: TitledEvent) => string;
  /** Nome da linha a mostrar (nome pt quando existe; senão, como `tr`). */
  trLine: (line: NameFields) => string;
  onView: (v: Bounds) => void;
  onCursor: (year: number) => void;
  onPoint: (laneId: string, event: TimelineLineEvent) => void;
  onInclude: (laneId: string) => void;
}

/** Altura de cada faixa: cresce quando há poucas linhas, dentro dos limites. */
function laneHeight(H: number, n: number): number {
  if (n === 0) return LANE_MIN;
  return Math.min(LANE_MAX, Math.max(LANE_MIN, (H - TOP - 6) / n));
}

/** Rótulo do selo "longe": quantos e os anos (no máximo dois). */
function farText(far: number[]): string {
  const years = far.slice(0, 2).map((y) => yearText(y));
  if (far.length > 2) years.push('…');
  return `${far.length} longe · ${years.join(', ')}`;
}

/** Título encurtado para o rótulo do ponto. */
function shortTitle(title: string): string {
  return title.length > TITLE_CHARS ? `${title.slice(0, TITLE_CHARS - 1)}…` : title;
}

/** Retângulo do selo "longe" (canto superior direito da faixa). */
function farRect(W: number, top: number, text: string): { x: number; y: number; w: number; h: number } {
  const w = text.length * 5.6 + 14;
  return { x: W - w - 6, y: top + 4, w, h: 18 };
}

/** Geometria do gráfico para uma janela de anos e um tamanho: escala, altura das faixas e funções de conversão. */
function geometry(view: Bounds, W: number, H: number, n: number) {
  const PW = Math.max(1, W - PADX * 2);
  const lh = laneHeight(H, n);
  const x = (year: number) => xOfYear(year, view.lo, view.hi, PADX, PW);
  const yearOf = (px: number) => yearAtX(px, view.lo, view.hi, PADX, PW);
  return { PW, lh, x, yearOf };
}

/** Ticks do eixo: passo que deixa rótulos com ≥ 70 px; o ano 0 não existe e fica de fora. */
function axisTicks(view: Bounds, PW: number): number[] {
  const step = tickStep(view.hi - view.lo, PW);
  const out: number[] = [];
  for (let t = Math.ceil(view.lo / step) * step; t <= view.hi; t += step) if (t !== 0) out.push(t);
  return out;
}

export function ParallelChart(props: ChartProps) {
  const { c, st } = useTheme();
  const { lanes, ext, view, cursor, favEvents, trTitle, trLine, onView, onCursor, onPoint, onInclude } = props;
  const [size, setSize] = useState({ W: 0, H: 0 });
  const { W, H } = size;
  // Altura do gráfico: a da área visível, ou o que cabe a faixa mínima de cada linha (o gráfico rola na vertical).
  const CH = Math.max(H, TOP + 6 + lanes.length * LANE_MIN);
  const { PW, lh, x, yearOf } = geometry(view, W, CH, lanes.length);
  const viewRef = useRef(view);
  viewRef.current = view;
  const startRef = useRef<Bounds | null>(null);

  // ---- gestos ----
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(4)
    .activeOffsetX([-6, 6])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startRef.current = viewRef.current;
    })
    .onUpdate((e) => {
      const s = startRef.current;
      if (!s || PW <= 0) return;
      const shift = (-e.translationX / PW) * (s.hi - s.lo);
      onView(clampView({ lo: s.lo + shift, hi: s.hi + shift }, ext));
    });
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      startRef.current = viewRef.current;
    })
    .onUpdate((e) => {
      const s = startRef.current;
      if (!s || PW <= 0) return;
      onView(zoomView(s, 1 / e.scale, yearAtX(e.focalX, s.lo, s.hi, PADX, PW), ext));
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .runOnJS(true)
    .onEnd((e, success) => {
      if (success) onView(zoomView(viewRef.current, 0.5, yearOf(e.x), ext));
    });
  const singleTap = Gesture.Tap()
    .maxDuration(260)
    .runOnJS(true)
    .onEnd((e, success) => {
      if (success) handleTap(e.x, e.y);
    });
  // Arrastar/pinça e toques não disputam: quem ativar primeiro vence (um toque nunca ativa o arrasto).
  const gesture = Gesture.Race(Gesture.Simultaneous(pan, pinch), Gesture.Exclusive(doubleTap, singleTap));

  /** Toque: selo "longe" inclui; ponto (perto o bastante) abre a prévia; o resto põe o cursor no ano tocado. */
  function handleTap(px: number, py: number) {
    const i = Math.floor((py - TOP) / lh);
    const lane = py >= TOP && i >= 0 && i < lanes.length ? lanes[i] : undefined;
    if (!lane) {
      onCursor(yearOf(px));
      return;
    }
    if (lane.far.length > 0) {
      const r = farRect(W, TOP + i * lh, farText(lane.far));
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        onInclude(lane.id);
        return;
      }
    }
    const cy = TOP + i * lh + lh * 0.62;
    let best: TimelineLineEvent | null = null;
    let bestD = HIT_X;
    for (const e of lane.visible) {
      const d = Math.abs(x(e.sortKey) - px);
      if (d <= bestD && Math.abs(py - cy) <= HIT_Y) {
        best = e;
        bestD = d;
      }
    }
    if (best) onPoint(lane.id, best);
    else onCursor(yearOf(px));
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== W || height !== H) setSize({ W: width, H: height });
  };

  return (
    <View style={{ flex: 1 }} onLayout={onLayout} accessibilityLabel={`${lanes.length} linhas`}>
      {W > 0 && H > 0 && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ height: CH }} showsVerticalScrollIndicator={CH > H}>
          <GestureDetector gesture={gesture}>
            <View testID="tl-chart" style={{ width: W, height: CH }} accessible accessibilityRole="image" accessibilityLabel={`Linhas do tempo em paralelo, ${yearText(view.lo)} a ${yearText(view.hi)}`}>
              <Svg width={W} height={CH}>
                <Rect x={0} y={0} width={W} height={CH} fill={c.bg} />
                {/* Eras: fundo alternado; a lacuna fica sem preenchimento. */}
                {TIMELINE_ERAS.map((era, i) => {
                  const x0 = Math.max(0, x(era.from));
                  const x1 = Math.min(W, x(era.to));
                  if (x1 <= x0) return null;
                  return <Rect key={era.id} x={x0} y={TOP} width={x1 - x0} height={CH - TOP} fill={i % 2 === 0 && !era.gap ? c.surfaceAlt : 'none'} opacity={0.55} />;
                })}
                {/* Eixo de anos. */}
                {axisTicks(view, PW).map((t) => (
                  <Line key={`t-${t}`} x1={x(t)} x2={x(t)} y1={TOP - 4} y2={CH} stroke={c.border} strokeWidth={1} />
                ))}
                {axisTicks(view, PW).map((t) => (
                  <SvgText key={`n-${t}`} x={x(t)} y={14} fill={c.muted} fontSize={10} fontFamily={fontFamilies.mono} textAnchor="middle">
                    {yearText(t)}
                  </SvgText>
                ))}
                {/* Faixas. */}
                {lanes.map((l, i) => {
                  const top = TOP + i * lh;
                  const cy = top + lh * 0.62;
                  const color = kindColor(l.line.kind, st);
                  const name = `${trLine(l.line)} · ${l.total}`;
                  const nameW = name.length * CHAR_W + 22;
                  const inView = l.visible.filter((e) => e.sortKey >= view.lo - 1 && e.sortKey <= view.hi + 1);
                  const withTitles = lh >= TITLE_MIN_LANE;
                  let lastEnd = 6 + nameW + 6;
                  const start = l.visible.length > 0 ? x(l.visible[0]!.sortKey) : 0;
                  const end = l.visible.length > 0 ? x(l.visible[l.visible.length - 1]!.sortKey) : 0;
                  const far = l.far.length > 0 ? farRect(W, top, farText(l.far)) : null;
                  return (
                    <G key={l.id}>
                      <Line x1={0} x2={W} y1={top} y2={top} stroke={c.border} strokeWidth={1} />
                      {l.visible.length > 1 && (
                        <Rect x={Math.max(0, start)} y={cy - 3} width={Math.max(2, end - start)} height={6} fill={color} opacity={0.18} />
                      )}
                      {/* Títulos acima dos pontos, só quando cabem e sem sobrepor. */}
                      {withTitles &&
                        inView.map((e) => {
                          const px = x(e.sortKey);
                          const label = shortTitle(trTitle(e));
                          const w = label.length * CHAR_W;
                          const lx = Math.max(4, px - 3);
                          if (lx <= lastEnd + 6 || lx + w >= W - 4) return null;
                          lastEnd = lx + w;
                          return (
                            <G key={`t-${e.cite_id}`}>
                              <Line x1={px} x2={px} y1={cy - 6} y2={cy - 14} stroke={color} strokeOpacity={0.5} strokeWidth={1} />
                              <SvgText x={lx} y={cy - 17} fill={c.text} fontSize={10.5} fontFamily={fontFamilies.uiSemibold}>
                                {label}
                              </SvgText>
                            </G>
                          );
                        })}
                      {inView.map((e) => {
                        const fav = favEvents.has(e.cite_id);
                        return <Circle key={e.cite_id} cx={x(e.sortKey)} cy={cy} r={fav ? 5 : 4} fill={fav ? c.accent : color} stroke={c.bg} strokeWidth={1.5} />;
                      })}
                      {/* Nome e contagem sobre o gráfico, no canto da faixa. */}
                      <Rect x={6} y={top + 4} width={nameW} height={18} rx={9} fill={c.bg} opacity={0.92} />
                      <Circle cx={15} cy={top + 13} r={3.5} fill={color} />
                      <SvgText x={23} y={top + 17} fill={c.text} fontSize={11} fontFamily={fontFamilies.uiBold}>
                        {name}
                      </SvgText>
                      {/* Selo "longe": eventos isolados fora da extensão; tocar inclui. */}
                      {far && (
                        <G>
                          <Rect x={far.x} y={far.y} width={far.w} height={far.h} rx={9} fill={c.surface} stroke={c.border} strokeWidth={1} />
                          <SvgText x={far.x + far.w / 2} y={far.y + 12.5} fill={c.muted} fontSize={10} fontFamily={fontFamilies.uiBold} textAnchor="middle">
                            {farText(l.far)}
                          </SvgText>
                        </G>
                      )}
                    </G>
                  );
                })}
                {/* Cursor de ano. */}
                {cursor !== null && cursor >= view.lo && cursor <= view.hi && (
                  <>
                    <Line x1={x(cursor)} x2={x(cursor)} y1={TOP - 4} y2={CH} stroke={c.accent} strokeWidth={1.5} />
                    <Rect x={Math.min(Math.max(x(cursor) - 40, 2), W - 82)} y={1} width={80} height={18} rx={6} fill={c.accent} />
                    <SvgText x={Math.min(Math.max(x(cursor), 42), W - 42)} y={14} fill={c.accentText} fontSize={10.5} fontFamily={fontFamilies.uiBold} textAnchor="middle">
                      {`≈ ${yearText(cursor)}`}
                    </SvgText>
                  </>
                )}
              </Svg>
            </View>
          </GestureDetector>
        </ScrollView>
      )}
    </View>
  );
}
