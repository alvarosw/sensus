// Primeira abertura: leva o app à apresentação antes de qualquer oferta (a de dados inclusive). Fica fora da pilha, que
// remonta ao trocar o idioma; por isso a key={lang} na raiz faz este gate rodar de novo, e o passo segue no store.
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAppPrefs } from '@/settings/app-prefs';

export function OnboardingGate() {
  useEffect(() => {
    if (!useAppPrefs.getState().onboardingDone) router.replace('/onboarding');
  }, []);
  return null;
}
