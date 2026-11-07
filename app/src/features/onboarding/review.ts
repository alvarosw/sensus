// Configurações > Sobre e licenças: "Rever a apresentação" zera o passo e abre o fluxo. Não muda a preferência
// (onboardingDone): o fim continua só fechando a apresentação.
import { router } from 'expo-router';
import { useOnboarding } from './onboarding-store';

export function reviewOnboarding(): void {
  useOnboarding.getState().go('abertura');
  router.push('/onboarding');
}
