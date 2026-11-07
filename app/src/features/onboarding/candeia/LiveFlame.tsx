// Chama viva: os dois desenhos da chama (corpo e núcleo) deformados na thread de UI pela tremulação e, quando a
// candeia anda, pela inclinação e pelo alongamento da física. A caixa tem a base da chama no centro; quem usa
// posiciona a caixa com o centro na boca do pavio.
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { View } from 'react-native';
import { FlameCore, FlameOuter, flameBox } from './FlameArt';
import { flicker } from './noise';
import type { LampSim } from './physics';

export interface LiveFlameProps {
  /** Altura da chama em repouso (px). */
  height: number;
  /** Relógio em segundos (thread de UI). */
  clock: SharedValue<number>;
  /** Separa a tremulação de chamas diferentes. */
  seed?: number;
  /** Escala da tremulação (1 normal; "reduzir movimento" usa pouco). */
  amount?: number;
  /** Física da candeia (inclinação e alongamento da chama), se ela estiver sendo carregada. */
  sim?: SharedValue<LampSim>;
  /** 0..1: a chama nascendo (acender). */
  ignite?: SharedValue<number>;
}

export function LiveFlame({ height, clock, seed = 0, amount = 1, sim, ignite }: LiveFlameProps) {
  const box = flameBox(height);
  const outer = useAnimatedStyle(() => {
    const f = flicker(clock.value, seed, amount);
    const s = sim ? sim.value : null;
    const lean = s ? s.lean : 0;
    const stretch = s ? s.stretch : 0;
    const g = ignite ? ignite.value : 1;
    // Ao nascer, a chama sobe de um ponto e passa um pouco da altura (labareda do acender).
    const grow = g < 1 ? g * (1 + 0.35 * Math.sin(g * Math.PI)) : 1;
    return {
      opacity: g < 0.05 ? g * 20 : 1,
      transform: [
        { skewX: `${-(lean + f.sway)}deg` },
        { scaleX: Math.max(0.01, f.scaleX * (1 - stretch * 0.45) * (0.4 + 0.6 * grow)) },
        { scaleY: Math.max(0.01, f.scaleY * (1 + stretch) * grow) },
      ],
    };
  });
  const core = useAnimatedStyle(() => {
    const f = flicker(clock.value + 0.21, seed + 3.7, amount * 0.7);
    const s = sim ? sim.value : null;
    const lean = s ? s.lean * 0.8 : 0;
    const stretch = s ? s.stretch * 0.8 : 0;
    const g = ignite ? ignite.value : 1;
    const grow = g < 0.35 ? 0 : Math.min(1, (g - 0.35) / 0.5);
    return {
      opacity: grow,
      transform: [
        { skewX: `${-(lean + f.sway * 0.7)}deg` },
        { scaleX: f.scaleX * (1 - stretch * 0.3) },
        { scaleY: Math.max(0.01, f.scaleY * (1 + stretch * 0.7) * grow) },
      ],
    };
  });
  return (
    <View style={{ width: box.width, height: box.height }} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, outer]}>
        <FlameOuter height={height} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, core]}>
        <FlameCore height={height} />
      </Animated.View>
    </View>
  );
}

/** Relógio da thread de UI em segundos, para a tremulação. */
export function useClock(active = true): SharedValue<number> {
  const clock = useSharedValue(0);
  useFrameCallback((f) => {
    clock.value = f.timestamp / 1000;
  }, active);
  return clock;
}
