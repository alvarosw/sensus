// Tradução automática da linha do tempo (títulos, nomes de linhas, participantes): política 'global' de
// useTranslatable. Os textos vêm da theographic; o idioma dela é lido do registro de fontes (isTranslatableSource),
// não suposto aqui. Sem oferta por item; um "Ver original" para a linha do tempo inteira.
import { useGlobalView } from './global-batch';
import { useTranslatable } from './useTranslatable';

/** Fonte dos dados da linha do tempo. */
export const TIMELINE_SOURCE = 'theographic';

const GLOBAL = { sourceId: TIMELINE_SOURCE, policy: 'global' } as const;

/** A tradução da linha do tempo está configurada: opção ligada e modelo pronto no aparelho. */
export function useTimelineActive(): boolean {
  return useTranslatable([], GLOBAL).active;
}

/** Estado para a tela: configurada, mostrando o original ou a tradução, e o "Ver original". */
export function useTimelineTranslation(): { active: boolean; showOriginal: boolean; toggle: () => void } {
  const tr = useTranslatable([], GLOBAL);
  return { active: tr.active, showOriginal: tr.showOriginal, toggle: tr.toggleOriginal };
}

/** Versão do cache de tradução: muda quando um lote chega (para memorizações que dependem da tradução). */
export function useTimelineVersion(): number {
  return useGlobalView((s) => s.version);
}

/** Um texto da linha do tempo, traduzido quando configurado (o original enquanto não chega). */
export function useTimelineText(text: string | null | undefined): string {
  const src = text ?? '';
  return useTranslatable(src, GLOBAL).show(src);
}

/**
 * Vários textos de uma vez (um lote por quadro). Devolve a função que dá o texto a mostrar; use-a em listas e no
 * gráfico, onde não se pode chamar um hook por item.
 */
export function useTimelineTexts(texts: readonly string[]): (text: string) => string {
  return useTranslatable(texts, GLOBAL).show;
}
