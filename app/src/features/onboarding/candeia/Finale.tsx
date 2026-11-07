// Fecho do onboarding: a candeia acesa no escuro; a luz cresce a partir da chama até inundar a tela e assenta nas
// cores do tema do app (claro ou escuro). Então a mensagem de conclusão e o convite aparecem, e o botão leva para dentro.
import { useEffect, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamilies, radius, useTheme } from '@/design';
import { CandeiaGlow } from './Glow';
import { WICK_FROM_CENTER } from './LampArt';
import { FloodLight } from './LightArt';
import { themed } from './palette';

export interface CandeiaFinaleProps {
  /** Conclusão ("Tudo pronto"). */
  title: string;
  /** Convite para começar a estudar. */
  body: string;
  ctaLabel: string;
  onDone: () => void;
  rtl?: boolean;
  testID?: string;
}

const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
const EASE_IN_OUT = Easing.bezier(0.5, 0, 0.2, 1);
const LAMP = 92;
/**
 * Lado (dp) do desenho da luz que inunda a tela. O tamanho final vem de transform de escala: no Android o
 * react-native-svg desenha cada SVG num bitmap do tamanho do componente, e um SVG do tamanho da diagonal da tela
 * (~8 mil pixels de lado) derrubava o app ("trying to draw too large bitmap").
 */
const FLOOD_DP = 400;

/** Fecho: a luz cresce até encher a tela; botão para entrar no app. */
export function CandeiaFinale({ title, body, ctaLabel, onDone, rtl = false, testID }: CandeiaFinaleProps) {
  const { c, scheme } = useTheme();
  const th = themed[scheme];
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [lamp, setLamp] = useState<{ x: number; y: number } | null>(null);

  const flood = useSharedValue(reduce ? 1 : 0);
  const content = useSharedValue(reduce ? 1 : 0);
  const cta = useSharedValue(reduce ? 1 : 0);
  const settle = useSharedValue(reduce ? 1 : 0);
  const [ready, setReady] = useState(reduce);

  useEffect(() => {
    if (reduce || !box || !lamp) return;
    flood.value = withDelay(900, withTiming(1, { duration: 2600, easing: EASE_IN_OUT }));
    // Depois da onda, o resto de dourado assenta na cor do tema.
    settle.value = withDelay(2900, withTiming(1, { duration: 1600, easing: EASE_IN_OUT }));
    content.value = withDelay(2700, withTiming(1, { duration: 1200, easing: EASE_OUT }));
    cta.value = withDelay(3500, withTiming(1, { duration: 800, easing: EASE_OUT }));
    const t = setTimeout(() => setReady(true), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, !!box, !!lamp]);

  // A luz nasce na chama e precisa cobrir até o canto mais distante.
  const diag = box ? Math.hypot(box.w, box.h) * 1.6 : 0;
  // O raio cresce devagar no começo (a área cresce com o quadrado do raio): a luz parece se espalhar, não saltar.
  // Escala que leva o desenho pequeno (FLOOD_DP) ao diâmetro necessário (2 × diag).
  const floodScale = useSharedValue(1);
  useEffect(() => {
    if (diag > 0) floodScale.value = (diag * 2) / FLOOD_DP;
  }, [diag, floodScale]);
  const floodStyle = useAnimatedStyle(() => ({
    opacity: flood.value < 0.02 ? flood.value * 50 : 1,
    transform: [{ scale: floodScale.value * (0.03 + 0.97 * Math.pow(flood.value, 1.5)) }],
  }));
  const settleStyle = useAnimatedStyle(() => ({ opacity: settle.value }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: content.value,
    transform: [{ translateY: (1 - content.value) * 14 }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: cta.value, transform: [{ translateY: (1 - cta.value) * 10 }] }));

  const onRoot = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
  };
  const onLamp = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    // Chama da candeia pequena (mesma conta de Glow.tsx): é dali que a luz nasce.
    setLamp({
      x: x + width / 2 + LAMP * (WICK_FROM_CENTER.x - 0.04),
      y: y + height / 2 + LAMP * (0.12 + WICK_FROM_CENTER.y - 0.15),
    });
  };

  const dir: TextStyle = rtl ? { writingDirection: 'rtl' } : { writingDirection: 'ltr' };
  const titleStyle: TextStyle = {
    fontFamily: fontFamilies.read,
    fontSize: 30,
    lineHeight: 40,
    color: c.text,
    textAlign: 'center',
  };
  const bodyStyle: TextStyle = {
    fontFamily: fontFamilies.read,
    fontSize: 18,
    lineHeight: 29,
    color: c.muted,
    textAlign: 'center',
  };

  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: th.dusk, overflow: 'hidden' }} onLayout={onRoot}>
      {box && lamp && (
        <>
          <Animated.View
            style={[{ position: 'absolute', left: lamp.x - FLOOD_DP / 2, top: lamp.y - FLOOD_DP / 2 }, floodStyle]}
            pointerEvents="none"
          >
            <FloodLight
              id={`candeiaFlood-${scheme}`}
              size={FLOOD_DP}
              inner={c.bg}
              edge={th.wave}
              spread={th.waveSpread}
              glow={th.waveGlow}
            />
          </Animated.View>
          <Animated.View
            style={[{ position: 'absolute', left: 0, top: 0, width: box.w, height: box.h, backgroundColor: c.bg }, settleStyle]}
            pointerEvents="none"
          />
        </>
      )}

      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28, paddingHorizontal: 32 }}>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'center' }} onLayout={onLamp}>
          <CandeiaGlow size={LAMP} />
        </View>
        <Animated.View style={[{ marginTop: 34, gap: 14 }, contentStyle]}>
          <Text accessibilityRole="header" style={[titleStyle, dir]}>{title}</Text>
          <Text style={[bodyStyle, dir]}>{body}</Text>
        </Animated.View>
        <View style={{ flex: 1.3 }} />
        <Animated.View style={[{ alignItems: 'center' }, ctaStyle]} pointerEvents={ready ? 'auto' : 'none'}>
          <Pressable
            testID={testID ? `${testID}-done` : undefined}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            onPress={onDone}
            hitSlop={8}
            style={({ pressed }) => ({
              minWidth: 200,
              height: 52,
              paddingHorizontal: 36,
              borderRadius: radius.pill,
              backgroundColor: c.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text style={{ fontFamily: fontFamilies.uiBold, fontSize: 16, letterSpacing: 0.3, color: c.accentText }}>{ctaLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
