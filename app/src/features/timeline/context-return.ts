// Volta à cronologia do trecho: depois de "Ler no texto", o leitor mostra uma pílula que reabre a cronologia no
// mesmo ponto de rolagem (ContextReturnPill). Estado só da sessão: não vai para o banco nem para o armazenamento.
import { create } from 'zustand';
import type { ContextScope, VerseSpan } from './context-model';

export interface ContextReturn {
  span: VerseSpan;
  scope: ContextScope;
  scrollY: number;
}

interface ContextReturnState {
  /** Onde a cronologia parou, enquanto o leitor está aberto (a pílula aparece com isso). */
  back: ContextReturn | null;
  /** Ponto a restaurar na próxima montagem da tela, aberta pela pílula. */
  resume: ContextReturn | null;
  remember(back: ContextReturn): void;
  dismiss(): void;
  /** Toque na pílula: passa o ponto para `resume` e devolve o destino. */
  resumeNow(): ContextReturn | null;
  /** Montagem da tela: consome o ponto a restaurar (null se não veio da pílula) e limpa a pílula. */
  takeResume(): ContextReturn | null;
}

export const useContextReturn = create<ContextReturnState>()((set, get) => ({
  back: null,
  resume: null,
  remember: (back) => set({ back }),
  dismiss: () => set({ back: null }),
  resumeNow: () => {
    const back = get().back;
    set({ resume: back, back: null });
    return back;
  },
  takeResume: () => {
    const resume = get().resume;
    set({ resume: null, back: null });
    return resume;
  },
}));
