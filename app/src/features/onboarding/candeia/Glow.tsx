// Candeia pequena acesa, para o topo dos passos do onboarding: a mesma lâmpada e a mesma chama da abertura, com
// um halo suave que tremula junto. Leve: dois desenhos estáticos e três estilos animados.
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/design';
import { flameBox } from './FlameArt';
import { LampBody, LampLight, LAMP_BOX, WICK_FROM_CENTER } from './LampArt';
import { RadialLight } from './LightArt';
import { LiveFlame, useClock } from './LiveFlame';
import { flicker } from './noise';
import { themed } from './palette';

export interface CandeiaGlowProps {
  size?: number;
  testID?: string;
}

/** Candeia pequena acesa (chama tremulando) para o topo dos passos. `size` = largura e altura da caixa. */
export function CandeiaGlow({ size = 40, testID }: CandeiaGlowProps) {
  const { scheme } = useTheme();
  const th = themed[scheme];
  const reduce = useReducedMotion();
  const amount = reduce ? 0.12 : 1;
  const clock = useClock();

  const lw = size;
  const lh = (lw * LAMP_BOX.h) / LAMP_BOX.w;
  const flameH = lw * 0.3;
  const fbox = flameBox(flameH);
  // O conjunto (chama em cima, pé embaixo) vai de -0,38 a +0,13 da largura em torno do ponto de apoio: centraliza.
  const cx = size / 2 - lw * 0.04;
  const cy = size / 2 + lw * 0.12;
  const wick = { x: cx + WICK_FROM_CENTER.x * lw, y: cy + WICK_FROM_CENTER.y * lw };
  const halo = size * 1.5;

  const haloStyle = useAnimatedStyle(() => {
    const f = flicker(clock.value, 1.1, amount);
    return { opacity: 0.8 + 0.2 * f.intensity, transform: [{ scale: 0.92 + 0.1 * f.intensity }] };
  });
  const lightStyle = useAnimatedStyle(() => {
    const f = flicker(clock.value + 0.03, 1.1, amount);
    return { opacity: Math.min(1, 0.62 + 0.38 * f.intensity * f.intensity) };
  });

  return (
    <View testID={testID} style={{ width: size, height: size }} pointerEvents="none" accessible={false}>
      <Animated.View
        style={[{ position: 'absolute', left: wick.x - halo / 2, top: wick.y - flameH * 0.5 - halo / 2 }, haloStyle]}
      >
        <RadialLight id={`candeiaGlow-${scheme}`} size={halo} color={th.halo} opacity={th.haloOpacity} falloff="halo" />
      </Animated.View>
      <View style={{ position: 'absolute', left: cx - lw / 2, top: cy - lh / 2 }}>
        <LampBody width={lw} />
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, lightStyle]}>
          <LampLight width={lw} />
        </Animated.View>
      </View>
      <View style={{ position: 'absolute', left: wick.x - fbox.width / 2, top: wick.y - fbox.height / 2 }}>
        <LiveFlame height={flameH} clock={clock} seed={1.1} amount={amount} />
      </View>
    </View>
  );
}
