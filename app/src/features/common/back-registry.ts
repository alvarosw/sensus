// Pilha das camadas do "voltar" do sistema, sem dependência de React Native (testável).
// Cada camada tem um token próprio: remover uma camada nunca remove outra registrada com o mesmo nome.

export interface BackLayer {
  id: string;
  priority: number;
  /** Ordem de registro (maior = mais recente): desempata camadas de mesma prioridade. */
  order: number;
  close: () => void;
}

const layers = new Map<number, BackLayer>();
let counter = 0;

/** Registra uma camada; a função devolvida a remove (idempotente). */
export function registerBackLayer(id: string, priority: number, close: () => void): () => void {
  const token = ++counter;
  layers.set(token, { id, priority, order: token, close });
  return () => {
    layers.delete(token);
  };
}

/** Camada mais à frente: maior prioridade e, em empate, a registrada por último. */
export function topBackLayer(): BackLayer | null {
  let top: BackLayer | null = null;
  for (const l of layers.values()) {
    if (!top || l.priority > top.priority || (l.priority === top.priority && l.order > top.order)) top = l;
  }
  return top;
}

/** Fecha a camada mais à frente. Retorna false se não havia nenhuma. */
export function closeTopLayer(): boolean {
  const top = topBackLayer();
  if (!top) return false;
  top.close();
  return true;
}

/** Quantas camadas estão abertas agora (para testes e diagnóstico). */
export function openBackLayerCount(): number {
  return layers.size;
}

export type BackAction = 'dismiss-keyboard' | 'close-layer' | 'confirm-exit';

/**
 * O que o "voltar" faz, na ordem do Android: primeiro esconde o teclado (se aberto), depois fecha a camada
 * mais à frente e, sem camadas, pede confirmação para sair do app.
 */
export function backAction(keyboardVisible: boolean, hasLayer: boolean): BackAction {
  if (keyboardVisible) return 'dismiss-keyboard';
  if (hasLayer) return 'close-layer';
  return 'confirm-exit';
}
