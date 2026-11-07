// Leva o app à apresentação antes de qualquer oferta (a de dados inclusive). Roda uma vez, na montagem:
//  - primeira abertura: a apresentação inteira. Durante ela a pilha não remonta ao trocar o idioma (ver _layout.tsx),
//    e o passo segue no store;
//  - apresentação já vista, mas nenhuma Bíblia baixada (atualizou de uma versão que trazia BLivre e KJV no app, ou os
//    arquivos sumiram): só o passo de Bíblia, que não deixa seguir sem uma.
// Enquanto a navegação não acontece, um véu escuro (a cor da abertura) cobre a tela: o leitor não pisca por baixo.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useBibles } from '@/data/bibles/bibles-store';
import { useAppPrefs } from '@/settings/app-prefs';
import { NIGHT } from './night';
import { useOnboarding } from './onboarding-store';

/** A apresentação vai abrir nesta execução (inteira ou só no passo de Bíblia)? Outras ofertas esperam. */
export function onboardingPending(): boolean {
  if (!useAppPrefs.getState().onboardingDone) return true;
  useBibles.getState().load();
  return useBibles.getState().installed.length === 0;
}

export function OnboardingGate() {
  const [covering, setCovering] = useState(onboardingPending);
  useEffect(() => {
    if (!onboardingPending()) return;
    if (useAppPrefs.getState().onboardingDone) {
      useOnboarding.getState().startBibleOnly();
      router.push('/onboarding');
    } else {
      router.replace('/onboarding');
    }
    // dois quadros: a rota nova já desenhou por cima quando o véu sai
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setCovering(false)));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!covering) return null;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: NIGHT }]} />;
}
