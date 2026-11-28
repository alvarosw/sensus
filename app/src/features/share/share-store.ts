// Prévia de copiar e compartilhar aberta agora (uma por vez). Quem abre: a barra da seleção (trecho) e a Visão geral
// da folha de estudo (síntese). A camada <SharePreview/> desenha a partir daqui.
import { create } from 'zustand';
import type { Vid } from '@sensus/core';

export type ShareIntent = 'copy' | 'share';

export type ShareRequest =
  /** Trecho da Bíblia `source` (o texto é lido do banco ao abrir). */
  | { kind: 'verses'; start: Vid; end: Vid; source: string; intent: ShareIntent }
  /** Síntese já montada em texto simples; `ref` entra no aviso "Copiado · síntese de …". */
  | { kind: 'synth'; text: string; ref: string };

interface ShareState {
  request: ShareRequest | null;
  open(request: ShareRequest): void;
  close(): void;
}

export const useShare = create<ShareState>()((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));
