// Régua de anos à direita da cronologia do trecho. A altura da régua é a da janela; cada ponto da lista (em
// coordenadas do conteúdo) cai na mesma proporção. Mostra o trecho (faixa), a parte da lista que está na tela
// (janela) e uma marca por ano com a densidade de eventos; tocar numa marca leva a lista a ela.
import { Pressable, View } from 'react-native';
import { Txt, useTheme } from '@/design';
import { TL } from './strings';

/** Largura da coluna da régua (a lista deixa essa folga à direita). */
export const RULER_W = 58;
/** Distância mínima (px da lista) entre duas marcas com rótulo. */
export const RULER_MIN_GAP = 16;

export interface RulerTick {
  year: number;
  count: number;
  /** Posição da marca no conteúdo da lista. */
  y: number;
}

export function ContextRuler({
  viewH,
  contentH,
  scrollY,
  band,
  ticks,
  onJump,
}: {
  viewH: number;
  contentH: number;
  scrollY: number;
  /** Trecho na lista (conteúdo), ou null se nenhuma linha dele foi medida. */
  band: { top: number; bottom: number } | null;
  ticks: readonly RulerTick[];
  onJump: (y: number) => void;
}) {
  const { c, st } = useTheme();
  const total = Math.max(contentH, viewH, 1);
  const k = viewH / total;
  const maxBar = 14;
  const maxCount = Math.max(1, ...ticks.map((t) => t.count));
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: RULER_W }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 1, backgroundColor: c.border }} />
      {band && (
        <View
          testID="ctx-band"
          pointerEvents="none"
          style={{ position: 'absolute', right: 0, width: 4, top: band.top * k, height: Math.max(3, (band.bottom - band.top) * k), backgroundColor: c.accent, borderRadius: 2 }}
        />
      )}
      <View
        testID="ctx-window"
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 8,
          width: 6,
          top: scrollY * k,
          height: Math.max(8, viewH * k),
          borderRadius: 3,
          borderWidth: 1,
          borderColor: st.ent,
        }}
      />
      {ticks.map((t) => (
        <Pressable
          key={t.year}
          testID={`ctx-tick-${t.year}`}
          accessibilityRole="button"
          accessibilityLabel={TL.rulerJump(t.year < 0 ? `${-t.year} a.C.` : `${t.year} d.C.`)}
          onPress={() => onJump(t.y)}
          hitSlop={6}
          style={{ position: 'absolute', right: 0, width: RULER_W, height: 18, top: t.y * (viewH / total) - 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingRight: 18 }}
        >
          <Txt v="mono" color="muted" style={{ fontSize: 9.5, lineHeight: 12 }} numberOfLines={1}>
            {t.year < 0 ? `${-t.year} a.C.` : `${t.year}`}
          </Txt>
          <View style={{ width: Math.max(2, (t.count / maxCount) * maxBar), height: 2, borderRadius: 1, backgroundColor: c.muted }} />
        </Pressable>
      ))}
    </View>
  );
}
