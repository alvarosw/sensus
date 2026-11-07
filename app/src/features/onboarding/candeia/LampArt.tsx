// Desenho da candeia de barro (lâmpada de azeite romana/herodiana, séc. I): corpo de terracota achatado, alça de
// anel atrás, disco côncavo com roseta em relevo e furo de enchimento, bico com canal e o pavio na ponta. Vista
// de três quartos, um pouco de cima. A luz vem da própria chama (à direita, na ponta do bico): a face voltada
// para ela é clara, o lado da alça e a barriga caem na sombra.
//
// Duas camadas estáticas: LampBody (o barro sob a luz da chama) e LampLight (o brilho quente que a chama joga no
// barro: bordas, bico, pavio). A cena anima só a opacidade de LampLight, junto com a tremulação.
import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { clay, flame } from './palette';
import { EllipseGradient } from './svg';

/** Caixa do desenho. O centro da caixa é o ponto de apoio (onde a mão segura; eixo do balanço). */
export const LAMP_BOX = { w: 240, h: 150 } as const;
const VB = '-8 9 240 150';
/** Ponto de apoio no sistema do desenho (centro da caixa). */
const PIVOT = { x: 112, y: 84 } as const;
/** Boca do pavio (base da chama), no sistema do desenho. */
const WICK = { x: 203.5, y: 66 } as const;

/** Posição da base da chama em relação ao centro da caixa, em frações da largura (para escalar). */
export const WICK_FROM_CENTER = { x: (WICK.x - PIVOT.x) / LAMP_BOX.w, y: (WICK.y - PIVOT.y) / LAMP_BOX.w } as const;

// Silhuetas (sistema do desenho).
const BODY_LOW = 'M 47 76 C 45 104, 78 124, 112 124 C 146 124, 179 104, 177 76';
const BODY = `${BODY_LOW} A 65 21 0 0 0 47 76 Z`;
const NOZZLE_SIDE =
  'M 152 70 L 196 63 C 210 61, 216 68, 214.4 76 C 212.6 85, 204 90, 195 89.6 C 182 89.2, 172 99, 160 111 C 168 96, 170 82, 152 70 Z';
const NOZZLE_TOP =
  'M 150 66.5 C 166 68, 176 69, 186 66.5 C 197 63.5, 214.4 64.5, 214.4 71 C 214.4 77.6, 199 79.2, 188 77.6 C 177 76, 166 80, 150 84.5 Z';
const HANDLE =
  'M 60 62 C 50 49, 29 43, 21 56 C 14 68, 22 85, 40 87 C 47 88, 53 85.5, 58 82 L 56 76 C 50 79.5, 41 80.5, 35 77.5 C 27 72.5, 28 61, 34 57 C 41 52.5, 50 58, 56 66 Z';

// Roseta: oito pétalas em relevo no disco, desenhadas num círculo e achatadas pela perspectiva.
const DISC = { x: 108.6, y: 77.6, ry: 0.33 } as const;
const PETALS = Array.from({ length: 8 }, (_, i) => (i / 8) * 360 + 22.5);
const PETAL = 'M 12.5 0 C 17 6, 28 6.6, 32.5 0 C 28 -6.6, 17 -6, 12.5 0 Z';
const PETAL_VEIN = 'M 15 0 L 29 0';
// Grãos do barro: posições fixas (pseudoaleatórias) sobre o corpo e o ombro.
const GRIT = [
  [70, 96, 0.7], [84, 104, 0.5], [131, 101, 0.6], [150, 95, 0.5], [96, 108, 0.4], [60, 86, 0.5], [118, 106, 0.6],
  [142, 106, 0.4], [76, 64, 0.4], [150, 62, 0.5], [168, 78, 0.45], [185, 84, 0.4], [104, 99, 0.35], [160, 100, 0.4],
  [57, 74, 0.35], [124, 58, 0.4], [92, 58, 0.35], [172, 70, 0.3], [196, 80, 0.35], [66, 102, 0.3], [138, 92, 0.3],
  [88, 92, 0.3], [64, 70, 0.3], [160, 58, 0.3],
] as const;

function Gradients() {
  return (
    <Defs>
      {/* Lado do corpo: da sombra (alça) à luz (bico). */}
      <LinearGradient id="lampSide" x1="44" y1="0" x2="214" y2="0" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={clay.deep} />
        <Stop offset="0.3" stopColor={clay.shade} />
        <Stop offset="0.66" stopColor={clay.mid} />
        <Stop offset="1" stopColor={clay.lit} />
      </LinearGradient>
      {/* Barriga: a luz vem de cima, o fundo some na sombra. */}
      <LinearGradient id="lampUnder" x1="0" y1="84" x2="0" y2="125" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={clay.deep} stopOpacity="0" />
        <Stop offset="0.55" stopColor={clay.deep} stopOpacity="0.45" />
        <Stop offset="1" stopColor={clay.deep} stopOpacity="0.92" />
      </LinearGradient>
      {/* Luz da chama batendo no lado, logo abaixo do bico. */}
      <EllipseGradient id="lampSideLight" cx={188} cy={82} rx={60} ry={34}>
        <Stop offset="0" stopColor={clay.lit} stopOpacity="0.8" />
        <Stop offset="1" stopColor={clay.lit} stopOpacity="0" />
      </EllipseGradient>
      {/* Ombro e face de cima do bico: plano que recebe a chama de raspão. */}
      <EllipseGradient id="lampTop" cx={204} cy={68} rx={170} ry={70}>
        <Stop offset="0" stopColor={clay.topLit} />
        <Stop offset="0.35" stopColor={clay.top} />
        <Stop offset="0.72" stopColor={clay.mid} />
        <Stop offset="1" stopColor={clay.shade} />
      </EllipseGradient>
      {/* O ombro é convexo: escurece na borda, onde vira para o lado. */}
      <EllipseGradient id="lampTopRoll" cx={112} cy={76} rx={65} ry={21}>
        <Stop offset="0.72" stopColor={clay.deep} stopOpacity="0" />
        <Stop offset="1" stopColor={clay.deep} stopOpacity="0.42" />
      </EllipseGradient>
      {/* Disco côncavo: a parede esquerda olha para a chama (clara); a direita fica à sombra do aro. */}
      <LinearGradient id="lampDisc" x1="68" y1="0" x2="150" y2="0" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={clay.topLit} />
        <Stop offset="0.45" stopColor={clay.top} />
        <Stop offset="1" stopColor={clay.shade} />
      </LinearGradient>
      <LinearGradient id="lampDiscShade" x1="0" y1="64" x2="0" y2="92" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={clay.deep} stopOpacity="0.6" />
        <Stop offset="0.4" stopColor={clay.deep} stopOpacity="0" />
      </LinearGradient>
      {/* Alça: atrás, longe da chama. */}
      <LinearGradient id="lampHandle" x1="16" y1="46" x2="58" y2="88" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={clay.mid} />
        <Stop offset="0.5" stopColor={clay.shade} />
        <Stop offset="1" stopColor={clay.deep} />
      </LinearGradient>
      <EllipseGradient id="lampOil" cx={DISC.x} cy={DISC.y} rx={7.5} ry={2.9}>
        <Stop offset="0" stopColor={clay.oil} />
        <Stop offset="1" stopColor={clay.deep} />
      </EllipseGradient>
    </Defs>
  );
}

/** Corpo da candeia sob a luz da própria chama. */
export const LampBody = memo(function LampBody({ width }: { width: number }) {
  const h = (width * LAMP_BOX.h) / LAMP_BOX.w;
  return (
    <Svg width={width} height={h} viewBox={VB}>
      <Gradients />

      {/* Alça de anel (atrás do corpo): volume, sulco e o alto que pega um resto de luz. */}
      <Path d={HANDLE} fill="url(#lampHandle)" />
      <Path d="M 57 64.5 C 48 53, 33 49, 27 58.5 C 21 67.5, 26 80.5, 41 82.5" fill="none" stroke={clay.deep} strokeOpacity={0.55} strokeWidth={1.1} />
      <Path d="M 57 60 C 47 48.5, 31 45, 23.5 55.5" fill="none" stroke={clay.top} strokeOpacity={0.5} strokeWidth={0.9} strokeLinecap="round" />

      {/* Pé (anel de base), espiando por baixo. */}
      <Ellipse cx={112} cy={122} rx={30} ry={6} fill={clay.deep} />
      <Path d="M 84 123 C 96 128, 128 128, 140 123" fill="none" stroke={clay.shade} strokeOpacity={0.6} strokeWidth={0.9} />

      {/* Corpo: lado, luz da chama no lado direito, barriga na sombra. */}
      <Path d={BODY} fill="url(#lampSide)" />
      <Path d={`${BODY_LOW} Z`} fill="url(#lampSideLight)" />
      <Path d={`${BODY_LOW} Z`} fill="url(#lampUnder)" />
      {/* Luz rebatida na beira de baixo (o barro devolve um pouco da luz para a sombra). */}
      <Path d="M 64 111 C 86 122, 138 122, 160 111" fill="none" stroke={clay.mid} strokeOpacity={0.2} strokeWidth={1.2} />

      {/* Bico: volume lateral. */}
      <Path d={NOZZLE_SIDE} fill="url(#lampSide)" />
      <Path d={NOZZLE_SIDE} fill="url(#lampSideLight)" />
      <Path d={NOZZLE_SIDE} fill="url(#lampUnder)" />

      {/* Ombro (face de cima) e face de cima do bico. */}
      <Ellipse cx={112} cy={76} rx={65} ry={21} fill="url(#lampTop)" />
      <Path d={NOZZLE_TOP} fill="url(#lampTop)" />
      <Ellipse cx={112} cy={76} rx={65} ry={21} fill="url(#lampTopRoll)" />
      {/* Aresta do ombro, que pega luz do lado do bico. */}
      <Path d="M 118 97 C 136 96, 152 92.5, 163 88" fill="none" stroke={clay.topLit} strokeOpacity={0.35} strokeWidth={0.9} strokeLinecap="round" />

      {/* Disco: aro em relevo e bacia côncava. */}
      <Ellipse cx={DISC.x - 0.6} cy={DISC.y - 0.8} rx={45} ry={14.8} fill={clay.top} />
      <Ellipse cx={DISC.x - 0.6} cy={DISC.y - 0.8} rx={45} ry={14.8} fill="url(#lampTopRoll)" fillOpacity={0.5} />
      <Path d="M 63 76.8 A 45 14.8 0 0 0 153 76.8" fill="none" stroke={clay.topLit} strokeOpacity={0.5} strokeWidth={0.9} />
      <Path d="M 63 76.8 A 45 14.8 0 0 1 153 76.8" fill="none" stroke={clay.incise} strokeOpacity={0.5} strokeWidth={0.9} />
      <Ellipse cx={DISC.x} cy={DISC.y} rx={40} ry={13.2} fill="url(#lampDisc)" />
      <Ellipse cx={DISC.x} cy={DISC.y} rx={40} ry={13.2} fill="url(#lampDiscShade)" />
      <Ellipse cx={DISC.x} cy={DISC.y} rx={40} ry={13.2} fill="none" stroke={clay.deep} strokeOpacity={0.4} strokeWidth={0.8} />

      {/* Roseta em relevo: pétala clara de frente para a luz, contorno fino na sombra. */}
      <G transform={`translate(${DISC.x} ${DISC.y}) scale(1 ${DISC.ry})`}>
        {PETALS.map((a) => (
          <G key={a} transform={`rotate(${a})`}>
            <Path d={PETAL} fill={clay.topLit} fillOpacity={0.32} stroke={clay.incise} strokeOpacity={0.75} strokeWidth={1.1} />
            <Path d={PETAL_VEIN} stroke={clay.incise} strokeOpacity={0.35} strokeWidth={0.9} />
          </G>
        ))}
        <Circle r={36.5} fill="none" stroke={clay.incise} strokeOpacity={0.28} strokeWidth={1.1} />
      </G>

      {/* Furo de enchimento, com o azeite lá dentro. */}
      <Ellipse cx={DISC.x + 0.4} cy={DISC.y + 0.9} rx={7.9} ry={3.2} fill={clay.inciseLit} fillOpacity={0.3} />
      <Ellipse cx={DISC.x} cy={DISC.y} rx={7.5} ry={2.9} fill="url(#lampOil)" />

      {/* Canal do disco até o pavio. */}
      <Path d="M 152 75.5 C 170 74.5, 184 73, 197 71.5" fill="none" stroke={clay.incise} strokeOpacity={0.85} strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M 152 76.6 C 170 75.6, 184 74.1, 197 72.6" fill="none" stroke={clay.inciseLit} strokeOpacity={0.4} strokeWidth={0.7} strokeLinecap="round" />

      {/* Boca do pavio e o pavio de linho torcido. */}
      <Ellipse cx={WICK.x} cy={70.8} rx={6.2} ry={2.7} fill={clay.deep} />
      <Path d="M 201.8 71 C 201.6 69, 202.6 67.6, 203.2 66.2" stroke={flame.wick} strokeWidth={2.2} strokeLinecap="round" fill="none" />

      {/* Grãos do barro. */}
      {GRIT.map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill={i % 3 === 0 ? clay.gritDark : clay.grit} fillOpacity={i % 3 === 0 ? 0.4 : 0.26} />
      ))}
    </Svg>
  );
});

/** Brilho quente da chama sobre o barro (a cena varia a opacidade com a tremulação). */
export const LampLight = memo(function LampLight({ width }: { width: number }) {
  const h = (width * LAMP_BOX.h) / LAMP_BOX.w;
  return (
    <Svg width={width} height={h} viewBox={VB}>
      <Defs>
        <EllipseGradient id="lampGlowTop" cx={WICK.x} cy={WICK.y + 4} rx={74} ry={30}>
          <Stop offset="0" stopColor={clay.rim} stopOpacity="0.55" />
          <Stop offset="0.45" stopColor={clay.rim} stopOpacity="0.12" />
          <Stop offset="1" stopColor={clay.rim} stopOpacity="0" />
        </EllipseGradient>
        <EllipseGradient id="lampGlowSide" cx={WICK.x} cy={WICK.y + 14} rx={40} ry={26}>
          <Stop offset="0" stopColor={clay.rim} stopOpacity="0.5" />
          <Stop offset="1" stopColor={clay.rim} stopOpacity="0" />
        </EllipseGradient>
        <LinearGradient id="lampRim" x1="60" y1="0" x2="214" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={clay.rim} stopOpacity="0" />
          <Stop offset="0.6" stopColor={clay.rim} stopOpacity="0.5" />
          <Stop offset="1" stopColor={clay.rim} stopOpacity="1" />
        </LinearGradient>
        <EllipseGradient id="lampWickGlow" cx={WICK.x} cy={WICK.y + 2} rx={9}>
          <Stop offset="0" stopColor={flame.wickGlow} stopOpacity="0.95" />
          <Stop offset="1" stopColor={flame.wickGlow} stopOpacity="0" />
        </EllipseGradient>
      </Defs>
      {/* Luz da chama sobre a face de cima do bico, o ombro e o lado do bico. */}
      <Path d={NOZZLE_TOP} fill="url(#lampGlowTop)" />
      <Path d={NOZZLE_SIDE} fill="url(#lampGlowSide)" />
      {/* Contorno iluminado: borda de trás do ombro, ponta do bico e aro do disco do lado da chama. */}
      <Path d="M 80 58 C 110 53.5, 150 56, 170 66" fill="none" stroke="url(#lampRim)" strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M 194 63.4 C 208 61.4, 215.6 66.5, 214.6 74" fill="none" stroke={clay.rim} strokeOpacity={0.9} strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M 128 63.6 C 140 64.6, 150 69, 152.5 76" fill="none" stroke={clay.rim} strokeOpacity={0.5} strokeWidth={0.9} strokeLinecap="round" />
      {/* Brasa do pavio e a borda da boca. */}
      <Ellipse cx={WICK.x} cy={70.8} rx={6.2} ry={2.7} fill="none" stroke={clay.rim} strokeOpacity={0.6} strokeWidth={0.8} />
      <Circle cx={WICK.x} cy={WICK.y + 2} r={9} fill="url(#lampWickGlow)" />
      <Circle cx={203.2} cy={66.6} r={1.1} fill={flame.wickGlow} />
      {/* Reflexo da chama no azeite. */}
      <Ellipse cx={DISC.x + 3} cy={DISC.y - 0.6} rx={2.4} ry={0.8} fill={clay.oilGlint} fillOpacity={0.65} />
    </Svg>
  );
});
