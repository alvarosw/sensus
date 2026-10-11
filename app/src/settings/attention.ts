// Aviso "Sua conexão com o ChatGPT precisa de atenção" (modal global). Não usa a chave de API.
import { create } from 'zustand';

export type AttentionReason = 'reauth' | 'not_eligible';

interface AttentionState {
  reason: AttentionReason | null;
  show(reason: AttentionReason): void;
  dismiss(): void;
}

export const useAttention = create<AttentionState>()((set) => ({
  reason: null,
  show: (reason) => set({ reason }),
  dismiss: () => set({ reason: null }),
}));

/** Abre o aviso a partir de qualquer lugar (cliente de IA, sem React). */
export function openChatGPTAttention(reason: AttentionReason): void {
  useAttention.getState().show(reason);
}
