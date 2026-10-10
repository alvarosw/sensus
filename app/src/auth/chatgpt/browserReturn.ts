// Detecta que o usuário voltou ao app sem concluir o login no navegador (back na aba, aba fechada).
// Lógica pura (sem React Native): o serviço alimenta com as transições do AppState e com o resultado do
// navegador, e recebe onCancel após uma folga curta, para dar tempo ao retorno do loopback chegar.
export const RETURN_GRACE_MS = 1500;

export type AppStateValue = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

export interface BrowserReturnWatch {
  /** Transição do AppState. Só conta depois de o app ter ido para segundo plano (a aba abriu). */
  appState(state: AppStateValue): void;
  /** Resultado do navegador: 'cancel' (fechou) e 'dismiss' contam como retorno; 'success' não. */
  browserClosed(type: string): void;
  /** Login concluído ou cancelado: cancela qualquer aviso pendente e não dispara mais. */
  settle(): void;
}

export function createBrowserReturnWatch(opts: {
  onCancel: () => void;
  graceMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}): BrowserReturnWatch {
  const graceMs = opts.graceMs ?? RETURN_GRACE_MS;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let wentToBackground = false;
  let settled = false;
  let timer: unknown = null;

  const schedule = () => {
    if (settled || timer !== null) return;
    timer = setTimer(() => {
      timer = null;
      if (!settled) {
        settled = true;
        opts.onCancel();
      }
    }, graceMs);
  };

  return {
    appState(state) {
      if (state === 'background' || state === 'inactive') wentToBackground = true;
      else if (state === 'active' && wentToBackground) schedule();
    },
    browserClosed(type) {
      if (type === 'cancel' || type === 'dismiss') schedule();
    },
    settle() {
      settled = true;
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
    },
  };
}
