// Desenhos estáticos da luz: halos radiais (poça de luz, brilho junto da chama) e o véu de escuridão com o furo
// por onde se lê. A cena só move e escala esses desenhos (transformações), nunca os redesenha.
import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Rect, Stop } from 'react-native-svg';
import { EllipseGradient } from './svg';

type Falloff = 'pool' | 'bloom' | 'halo';

// Curvas de queda da luz (deslocamento, opacidade relativa). Quedas longas e suaves: luz de vela não tem borda.
const FALLOFF: Record<Falloff, ReadonlyArray<readonly [number, number]>> = {
  pool: [[0, 1], [0.18, 0.72], [0.42, 0.32], [0.7, 0.09], [1, 0]],
  bloom: [[0, 1], [0.12, 0.85], [0.35, 0.38], [0.65, 0.1], [1, 0]],
  halo: [[0, 1], [0.3, 0.55], [0.6, 0.18], [1, 0]],
};

/** Círculo de luz com queda radial. `size` = diâmetro em px; `opacity` = opacidade no centro. */
export const RadialLight = memo(function RadialLight({
  id,
  size,
  color,
  opacity = 1,
  falloff = 'pool',
  core,
}: {
  id: string;
  size: number;
  color: string;
  opacity?: number;
  falloff?: Falloff;
  /** Cor do miolo (opcional), para o centro mais quente que a borda. */
  core?: string;
}) {
  const stops = FALLOFF[falloff];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <EllipseGradient id={id} cx={50} cy={50} rx={50}>
          {stops.map(([o, a], i) => (
            <Stop key={o} offset={o} stopColor={core && i === 0 ? core : color} stopOpacity={a * opacity} />
          ))}
        </EllipseGradient>
      </Defs>
      <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} />
    </Svg>
  );
});

// Furo do véu: transparente no meio, escuro do meio para fora, opaco bem antes da borda (assim a escala da
// tremulação não abre fresta entre o furo e as quatro faixas sólidas em volta).
const HOLE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.12, 0],
  [0.26, 0.22],
  [0.4, 0.6],
  [0.52, 0.86],
  [0.64, 0.97],
  [0.74, 1],
  [1, 1],
];

/** Furo do véu (`w`×`h` px, elíptico quando w ≠ h), da cor da escuridão. */
export const VeilHole = memo(function VeilHole({ w, h, color }: { w: number; h: number; color: string }) {
  return (
    <Svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <EllipseGradient id="veilHole" cx={50} cy={50} rx={50}>
          {HOLE.map(([o, a]) => (
            <Stop key={o} offset={o} stopColor={color} stopOpacity={a} />
          ))}
        </EllipseGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#veilHole)" />
    </Svg>
  );
});

/**
 * Moldura do véu: quatro faixas sólidas em volta de uma caixa `w`×`h` (onde fica o furo), grandes o bastante
 * para cobrir a tela com o furo em qualquer ponto dela. As faixas entram 10% na caixa, onde o furo já é opaco;
 * assim a escala da tremulação (até 0,8) não abre fresta.
 */
export function VeilFrame({ w, h, reach, color, children }: { w: number; h: number; reach: number; color: string; children?: ReactNode }) {
  const ox = w * 0.1;
  const oy = h * 0.1;
  const band = { position: 'absolute', backgroundColor: color } as const;
  return (
    <View style={{ width: w, height: h }} pointerEvents="none">
      {children}
      <View style={[band, { left: -reach, top: -reach, width: 2 * reach + w, height: reach + oy }]} />
      <View style={[band, { left: -reach, top: h - oy, width: 2 * reach + w, height: reach + oy }]} />
      <View style={[band, { left: -reach, top: oy, width: reach + ox, height: h - 2 * oy }]} />
      <View style={[band, { left: w - ox, top: oy, width: reach + ox, height: h - 2 * oy }]} />
    </View>
  );
}

/** Vinheta: os cantos da cena mais escuros, para a luz parecer cercada de noite. */
export const Vignette = memo(function Vignette({ w, h, color }: { w: number; h: number; color: string }) {
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} pointerEvents="none">
      <Defs>
        <EllipseGradient id="vignette" cx={w / 2} cy={h * 0.46} rx={w * 0.95} ry={h * 0.72}>
          <Stop offset="0" stopColor={color} stopOpacity="0" />
          <Stop offset="0.55" stopColor={color} stopOpacity="0" />
          <Stop offset="0.85" stopColor={color} stopOpacity="0.45" />
          <Stop offset="1" stopColor={color} stopOpacity="0.8" />
        </EllipseGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#vignette)" />
    </Svg>
  );
});

/**
 * Luz que inunda a tela no fecho: miolo da cor do tema e uma frente dourada que se desfaz na borda (sem o anel
 * acinzentado que o papel claro faria ao se misturar direto com o escuro).
 */
export const FloodLight = memo(function FloodLight({
  id,
  size,
  inner,
  edge,
  spread = 0.58,
  glow = 0.95,
}: {
  id: string;
  size: number;
  inner: string;
  edge: string;
  /** Até onde (fração do raio) vai o miolo sólido; daí até a borda é a frente dourada. */
  spread?: number;
  /** Opacidade do dourado logo depois do miolo. */
  glow?: number;
}) {
  const mid = spread + (1 - spread) * 0.35;
  const out = spread + (1 - spread) * 0.67;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <EllipseGradient id={id} cx={50} cy={50} rx={50}>
          <Stop offset={0} stopColor={inner} stopOpacity={1} />
          <Stop offset={spread} stopColor={inner} stopOpacity={1} />
          <Stop offset={mid} stopColor={edge} stopOpacity={glow} />
          <Stop offset={out} stopColor={edge} stopOpacity={glow * 0.47} />
          <Stop offset={1} stopColor={edge} stopOpacity={0} />
        </EllipseGradient>
      </Defs>
      <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} />
    </Svg>
  );
});
