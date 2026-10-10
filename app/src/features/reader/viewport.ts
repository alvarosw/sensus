// Quanto da base do leitor a folha de estudo cobre em cada altura (fração da área abaixo da barra superior).
import { detents, type Detent } from '@/design';

/** Altura (px) coberta pela folha. `full` conta como `half`: o leitor só precisa de folga de rolagem. */
export function sheetCover(detent: Detent, areaHeight: number): number {
  if (detent === 'closed') return 0;
  return Math.round(detents[detent === 'full' ? 'half' : detent] * areaHeight);
}
