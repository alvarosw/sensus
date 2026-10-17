// Trilho de lentes: faixa horizontal sobre a rolagem da folha. Toque leva à lente; a lente atual fica marcada.
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { radius, Txt, useTheme } from '@/design';
import { LENS_KEYS, LENS_LABELS, useStudy, type LensKey } from '@/state/study';
import { STUDY } from './strings';

export function Rail({ active }: { active: boolean }) {
  const { c } = useTheme();
  const storeLens = useStudy((s) => s.lens);
  const lens = active ? storeLens : null;
  const goToLens = useStudy((s) => s.goToLens);
  const strip = useRef<ScrollView>(null);
  const xs = useRef<Partial<Record<LensKey, number>>>({});

  useEffect(() => {
    const x = lens ? xs.current[lens] : undefined;
    if (x !== undefined) strip.current?.scrollTo({ x: Math.max(0, x - 40), animated: true });
  }, [lens]);

  return (
    <View
      accessibilityLabel={STUDY.railLabel}
      style={{ backgroundColor: c.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border }}
    >
      <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingHorizontal: 12, paddingVertical: 8 }}>
        {LENS_KEYS.map((k) => {
          const on = k === lens;
          return (
            <Pressable
              key={k}
              testID={`rail-${k}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onLayout={(e) => (xs.current[k] = e.nativeEvent.layout.x)}
              onPress={() => goToLens(k)}
              style={{ borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: on ? c.chip : 'transparent' }}
            >
              <Txt v="button" tint={on ? c.accent : c.muted} style={{ fontSize: 12.5 }}>{LENS_LABELS[k]}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
