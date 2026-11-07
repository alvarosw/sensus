// Chama da candeia em camadas, de fora para dentro: borda alaranjada que se apaga na ponta, corpo âmbar, núcleo
// quase branco e a base azulada (onde o azeite queima limpo, sem fuligem), com a zona escura do vapor logo acima
// do pavio. São dois desenhos estáticos (corpo e núcleo) que a cena deforma com transformações, cada um com sua
// própria tremulação: assim a chama parece ter espessura, sem redesenhar SVG a cada quadro.
import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, Path, Stop } from 'react-native-svg';
import { flame } from './palette';
import { EllipseGradient } from './svg';

/** Caixa do desenho; a base da chama (boca do pavio) fica em BASE_Y. */
export const FLAME_BOX = { w: 60, h: 120 } as const;
const BASE_Y = 116;

/**
 * Altura da caixa (em px) para uma chama de `height` px: o dobro da altura até a base, para que o centro da caixa
 * seja a base da chama e escala e inclinação aconteçam em torno dela.
 */
export function flameBox(height: number): { width: number; height: number; svgHeight: number } {
  const svgHeight = (height * FLAME_BOX.h) / BASE_Y;
  return { width: (svgHeight * FLAME_BOX.w) / FLAME_BOX.h, height: 2 * height, svgHeight };
}

function Box({ height, children }: { height: number; children: React.ReactNode }) {
  const b = flameBox(height);
  return (
    <View style={{ width: b.width, height: b.height }} pointerEvents="none">
      <Svg width={b.width} height={b.svgHeight} viewBox={`0 0 ${FLAME_BOX.w} ${FLAME_BOX.h}`}>
        {children}
      </Svg>
    </View>
  );
}

/** Borda e corpo da chama. `height` = altura da chama em px. */
export const FlameOuter = memo(function FlameOuter({ height }: { height: number }) {
  return (
    <Box height={height}>
      <Defs>
        <EllipseGradient id="flameOuter" cx={30} cy={88} rx={21} ry={84} fy={96}>
          <Stop offset="0" stopColor={flame.body} stopOpacity="1" />
          <Stop offset="0.42" stopColor={flame.bodyDeep} stopOpacity="0.96" />
          <Stop offset="0.7" stopColor={flame.rim} stopOpacity="0.82" />
          <Stop offset="0.88" stopColor={flame.tip} stopOpacity="0.38" />
          <Stop offset="1" stopColor={flame.tip} stopOpacity="0" />
        </EllipseGradient>
        <EllipseGradient id="flameAura" cx={30} cy={84} rx={26} ry={52}>
          <Stop offset="0" stopColor={flame.bodyDeep} stopOpacity="0.5" />
          <Stop offset="0.6" stopColor={flame.rim} stopOpacity="0.16" />
          <Stop offset="1" stopColor={flame.rim} stopOpacity="0" />
        </EllipseGradient>
        <EllipseGradient id="flameBody" cx={30} cy={92} rx={14} ry={62}>
          <Stop offset="0" stopColor={flame.coreEdge} stopOpacity="1" />
          <Stop offset="0.5" stopColor={flame.body} stopOpacity="0.92" />
          <Stop offset="1" stopColor={flame.bodyDeep} stopOpacity="0" />
        </EllipseGradient>
      </Defs>
      {/* Aura: a chama não tem borda dura. */}
      <Ellipse cx={30} cy={80} rx={29} ry={44} fill="url(#flameAura)" />
      <Path d="M30 6 C 33.5 30, 47 54, 47 81 C 47 101, 40 116, 30 116 C 20 116, 13 101, 13 81 C 13 54, 26.5 30, 30 6 Z" fill="url(#flameOuter)" />
      <Path d="M30 28 C 33 47, 42 64, 42 85 C 42 102, 37 113, 30 113 C 23 113, 18 102, 18 85 C 18 64, 27 47, 30 28 Z" fill="url(#flameBody)" />
    </Box>
  );
});

/** Núcleo branco, base azul e a zona escura do vapor. */
export const FlameCore = memo(function FlameCore({ height }: { height: number }) {
  return (
    <Box height={height}>
      <Defs>
        <EllipseGradient id="flameCore" cx={30} cy={90} rx={9} ry={42}>
          <Stop offset="0" stopColor={flame.core} stopOpacity="1" />
          <Stop offset="0.6" stopColor={flame.core} stopOpacity="0.97" />
          <Stop offset="1" stopColor={flame.coreEdge} stopOpacity="0.1" />
        </EllipseGradient>
        <EllipseGradient id="flameBlue" cx={30} cy={109} rx={13} ry={8}>
          <Stop offset="0" stopColor={flame.blue} stopOpacity="0" />
          <Stop offset="0.75" stopColor={flame.blue} stopOpacity="0.45" />
          <Stop offset="1" stopColor={flame.blueDeep} stopOpacity="0" />
        </EllipseGradient>
        <EllipseGradient id="flameVapor" cx={30} cy={110} rx={4} ry={8}>
          <Stop offset="0" stopColor={flame.rim} stopOpacity="0.75" />
          <Stop offset="1" stopColor={flame.bodyDeep} stopOpacity="0" />
        </EllipseGradient>
      </Defs>
      <Path d="M30 48 C 32.4 61, 38 74, 38 88 C 38 100, 34.5 108, 30 108 C 25.5 108, 22 100, 22 88 C 22 74, 27.6 61, 30 48 Z" fill="url(#flameCore)" />
      {/* Vapor ainda sem queimar logo acima do pavio, e a ponta do pavio dentro da chama. */}
      <Ellipse cx={30} cy={109} rx={4} ry={7.5} fill="url(#flameVapor)" />
      <Path d="M29.2 117 C 29 113, 30.6 110, 31 106.5" stroke={flame.wick} strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d="M17 104 C 19 117, 41 117, 43 104 C 39 112.5, 21 112.5, 17 104 Z" fill="url(#flameBlue)" />
    </Box>
  );
});
