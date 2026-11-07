// Moldura dos passos do meio: candeia pequena no topo, Voltar e Pular (quando cabem; ver onboarding-model), e os pontos
// de progresso (docs/design/onboarding.md).
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CandeiaGlow } from './candeia';
import { LinkButton, useTheme } from '@/design';
import { SETTINGS_COPY } from '@/settings/strings';
import { ONBOARDING_COPY } from './strings';
import { back, canSkip, progressOf, type OnboardingContext, type OnboardingStep } from './onboarding-model';

export interface StepFrameProps {
  step: OnboardingStep;
  ctx: OnboardingContext;
  onBack: () => void;
  onSkip: () => void;
  children: ReactNode;
}

export function StepFrame({ step, ctx, onBack, onSkip, children }: StepFrameProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = progressOf(step, ctx);
  const canBack = back(step, ctx) !== step;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 68 }}>
        <View style={{ minWidth: 88, alignItems: 'flex-start' }}>
          {canBack ? <LinkButton testID="onb-back" label={SETTINGS_COPY.back} onPress={onBack} /> : null}
        </View>
        <CandeiaGlow size={52} testID="onb-glow" />
        <View style={{ minWidth: 88, alignItems: 'flex-end' }}>
          {canSkip(step, ctx) ? <LinkButton testID="onb-skip" label={ONBOARDING_COPY.skip} onPress={onSkip} /> : null}
        </View>
      </View>
      {progress ? (
        <View
          testID="onb-progress"
          accessible
          accessibilityLabel={ONBOARDING_COPY.stepCount(progress.index, progress.total)}
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 12 }}
        >
          {Array.from({ length: progress.total }, (_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i + 1 === progress.index ? c.accent : c.border,
              }}
            />
          ))}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
