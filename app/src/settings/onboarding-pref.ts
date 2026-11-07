// Quem vê a apresentação de primeira vez (docs/design/onboarding.md, "Quem vê"). Regra pura, usada por app-prefs.ts
// ao carregar: ela precisa ficar em settings/ (camada de serviço, abaixo de features/). O fluxo está em features/onboarding.
/**
 * Mostrar a apresentação ao abrir o app? Instalação nova sim. Preferências gravadas sem `onboardingDone` são de quem já
 * usava o app: não mostra, e app-prefs grava a chave como `true` na primeira carga. Com a chave gravada, vale a chave.
 */
export function shouldShowOnboarding(input: { hasStoredPrefs: boolean; onboardingDone: boolean | undefined }): boolean {
  if (input.onboardingDone !== undefined) return !input.onboardingDone;
  return !input.hasStoredPrefs;
}
