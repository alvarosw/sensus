// Primeira abertura: leva o app à apresentação antes de qualquer oferta (a de dados inclusive). Fica fora da pilha, que
// remonta ao trocar o idioma; por isso a key={lang} na raiz faz este gate rodar de novo, e o passo segue no store.
// Enquanto a navegação não acontece, um véu escuro (a cor da abertura) cobre a tela: o leitor não pisca por baixo.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAppPrefs } from '@/settings/app-prefs';
import { NIGHT } from './night';

export function OnboardingGate() {
  const [covering, setCovering] = useState(() => !useAppPrefs.getState().onboardingDone);
  useEffect(() => {
    if (useAppPrefs.getState().onboardingDone) return;
    router.replace('/onboarding');
    // dois quadros: a rota nova já desenhou por cima quando o véu sai
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setCovering(false)));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!covering) return null;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: NIGHT }]} />;
}
