// Posição da bolinha do chat: borda (esquerda/direita) + distância da base, como no protótipo.
import { detents, size } from '@/design';

export const BUBBLE_MARGIN = 14;
/** Distância mínima do topo ao centro da bolinha (a bolinha não sobe além disso). */
const TOP_ROOM = 130;

export interface Metrics {
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
}

/** Altura da folha em "espiar": 30% da área abaixo da barra superior. */
export function peekHeight(m: Metrics): number {
  return detents.peek * (m.height - m.insetTop - size.topBar);
}

/** Menor distância da base: acima da folha em "espiar"; no canto nos demais casos. */
export function minBottom(detent: string, m: Metrics): number {
  return detent === 'peek' ? peekHeight(m) + BUBBLE_MARGIN : 18 + m.insetBottom;
}

export function clampBottom(stored: number | null, detent: string, m: Metrics): number {
  const min = minBottom(detent, m);
  return Math.max(min, Math.min(m.height - TOP_ROOM, stored ?? min));
}

export function bubbleLeft(side: 'left' | 'right', m: Metrics): number {
  return side === 'left' ? BUBBLE_MARGIN : m.width - BUBBLE_MARGIN - size.bubble;
}
