// Onboarding (docs/design/onboarding.md): ordem dos passos, avançar, voltar e pular, e quem vê a apresentação.
// Regras puras: sem React, sem store e sem banco. Quem chama passa o que sabe (dados instalados, preferências gravadas).

export const ONBOARDING_STEPS = ['abertura', 'idioma', 'biblia', 'tradicoes', 'ia', 'dados', 'fim'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Resultado de um movimento: um passo, ou `done` quando a apresentação termina. */
export const ONBOARDING_DONE = 'done';
export type OnboardingMove = OnboardingStep | typeof ONBOARDING_DONE;

export interface OnboardingContext {
  /** Banco completo já instalado (edição 'full'): o passo de dados não aparece. */
  dataInstalled: boolean;
}

/** Passos que este aparelho mostra, na ordem. O de dados some quando os dados completos já estão instalados. */
export function stepsFor(ctx: OnboardingContext): OnboardingStep[] {
  return ONBOARDING_STEPS.filter((s) => s !== 'dados' || !ctx.dataInstalled);
}

/**
 * Próximo passo visível depois de `step`. Se `step` é o último ('fim'), o movimento é concluir.
 * Funciona mesmo quando `step` já não está na lista (ex.: os dados ficaram instalados enquanto o passo estava aberto).
 */
export function advance(step: OnboardingStep, ctx: OnboardingContext): OnboardingMove {
  if (step === 'fim') return ONBOARDING_DONE;
  const visible = stepsFor(ctx);
  const after = ONBOARDING_STEPS.slice(ONBOARDING_STEPS.indexOf(step) + 1);
  return after.find((s) => visible.includes(s)) ?? ONBOARDING_DONE;
}

/** Passo visível anterior. No primeiro, fica nele: não há como sair do fluxo voltando. */
export function back(step: OnboardingStep, ctx: OnboardingContext): OnboardingStep {
  const visible = stepsFor(ctx);
  const before = ONBOARDING_STEPS.slice(0, ONBOARDING_STEPS.indexOf(step)).reverse();
  return before.find((s) => visible.includes(s)) ?? step;
}

/** Pular conclui a apresentação em qualquer passo (o botão só aparece nos passos do meio). */
export function skip(): OnboardingMove {
  return ONBOARDING_DONE;
}

/** Os passos do meio (sem abertura e fim) têm pontos de progresso e o botão Pular. */
export function isMiddleStep(step: OnboardingStep): boolean {
  return step !== 'abertura' && step !== 'fim';
}

/** Posição do passo entre os do meio (base 1) e o total deles. Null nos passos sem progresso. */
export function progressOf(step: OnboardingStep, ctx: OnboardingContext): { index: number; total: number } | null {
  if (!isMiddleStep(step)) return null;
  const middle = stepsFor(ctx).filter(isMiddleStep);
  const at = middle.indexOf(step);
  // passo que já não está na lista (dados instalados enquanto aberto): conta como o último do meio
  return { index: at < 0 ? middle.length : at + 1, total: middle.length };
}
