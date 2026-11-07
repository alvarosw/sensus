// Fluxo da apresentação: mostra o passo do store, troca de passo e conclui. Sem cabeçalho (a rota cuida disso).
// O voltar do Android anda um passo e nunca sai do fluxo; o iOS não tem gesto de voltar aqui (gestureEnabled: false).
import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useDataStore } from '@/data/data-store';
import { useAppPrefs } from '@/settings/app-prefs';
import { useLang } from '@/i18n';
import { StepFrame } from './StepFrame';
import { StepOpening } from './StepOpening';
import { StepLanguage } from './StepLanguage';
import { StepBible } from './StepBible';
import { StepTraditions } from './StepTraditions';
import { StepAi } from './StepAi';
import { StepData } from './StepData';
import { StepFinale } from './StepFinale';
import { advance, back, ONBOARDING_DONE, skip, type OnboardingMove, type OnboardingStep } from './onboarding-model';
import { useOnboarding } from './onboarding-store';

/**
 * Concluir: grava a apresentação como vista. Na primeira vez, isso muda a chave da pilha (_layout.tsx), que remonta no
 * idioma escolhido e abre no leitor; ao rever pela Configuração, só fecha a apresentação.
 */
function finish(): void {
  const firstRun = !useAppPrefs.getState().onboardingDone;
  useAppPrefs.getState().setOnboardingDone(true);
  if (!firstRun) router.dismissTo('/');
}

export function OnboardingFlow() {
  // Re-renderiza ao trocar o idioma (os textos leem o idioma na hora).
  useLang();
  const dataInstalled = useDataStore((s) => s.edition === 'full');
  const step = useOnboarding((s) => s.step);
  const ctx = { dataInstalled };

  const move = (m: OnboardingMove) => {
    if (m === ONBOARDING_DONE) finish();
    else useOnboarding.getState().go(m);
  };
  const next = () => move(advance(step, ctx));
  const prev = () => useOnboarding.getState().go(back(step, ctx));

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        prev();
        return true;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, dataInstalled]),
  );

  if (step === 'abertura') return <StepOpening onNext={next} />;
  if (step === 'fim') return <StepFinale onDone={next} />;
  return (
    <StepFrame step={step} ctx={ctx} onBack={prev} onSkip={() => move(skip())}>
      {renderMiddle(step, next)}
    </StepFrame>
  );
}

function renderMiddle(step: OnboardingStep, onNext: () => void) {
  switch (step) {
    case 'idioma':
      return <StepLanguage onNext={onNext} />;
    case 'biblia':
      return <StepBible onNext={onNext} />;
    case 'tradicoes':
      return <StepTraditions onNext={onNext} />;
    case 'ia':
      return <StepAi onNext={onNext} />;
    case 'dados':
      return <StepData onNext={onNext} />;
    default:
      return null;
  }
}
