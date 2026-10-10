import { useEffect, useRef } from 'react';
import { Animated, View, type DimensionValue } from 'react-native';
import { useTheme } from './theme';

/** Barras de carregamento com pulso, de altura fixa (evita saltos de layout ao chegar o texto). */
export function Skeleton({ lines = 3, widths }: { lines?: number; widths?: DimensionValue[] }) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const defaults: DimensionValue[] = ['100%', '92%', '64%', '80%'];
  return (
    <Animated.View style={{ opacity: pulse, gap: 10 }}>
      {Array.from({ length: lines }, (_, i) => (
        <View
          key={i}
          style={{
            height: 14,
            borderRadius: 7,
            width: widths?.[i] ?? defaults[i % defaults.length],
            backgroundColor: theme.surfaceAlt,
          }}
        />
      ))}
    </Animated.View>
  );
}
