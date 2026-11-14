// Textos curtos de um bloco (glosas, títulos de verbete e de tópico): um lote de tradução e uma nota. A ordem de
// exibição é a do núcleo (shownShortText): pacote -> tradução pronta -> original. Sem oferta: ela fica com os blocos
// de prosa (comentário, corpo de verbete, painel de fonte, popover).
import { machineBatch, shortTextMark, shownShortText, type ShortText, type ShownVia } from '@sensus/core';
import { useLang } from '@/i18n/lang-store';
import { useTranslatable, type Translatable } from './useTranslatable';

export interface ShortTextView {
  text: string;
  via: ShownVia;
  /** Marca discreta (língua do original), ou null. */
  mark: string | null;
}

export interface ShortTexts {
  /** Texto a mostrar para um item do bloco; null quando o item é null/undefined. */
  view(item: ShortText | null | undefined): ShortTextView | null;
  /** Nota do lote (uma por bloco, nunca por item). */
  note: Translatable;
}

export function useShortTexts(items: readonly (ShortText | null | undefined)[], opts: { offer?: boolean } = {}): ShortTexts {
  const appLang = useLang();
  const batch = machineBatch(items);
  const note = useTranslatable(batch.texts, { lang: batch.lang, policy: 'item', offer: opts.offer ?? false });
  return {
    note,
    view: (item) => {
      if (!item) return null;
      const fm = item.forMachine;
      const shown = shownShortText({
        packValue: item.packValue,
        original: item.original,
        machine: fm !== null && item.lang === batch.lang ? note.machine(fm) : null,
        appLang,
        originalLang: item.lang,
      });
      return { text: shown.text, via: shown.via, mark: shortTextMark(shown, appLang) };
    },
  };
}
