// Direção de leitura da interface (fase 1, docs/design/idiomas-biblias-fontes.md §0): com árabe ou urdu, o texto da
// interface alinha à direita e segue a direção da escrita, sem espelhar o layout. Texto bíblico, de fonte, de
// comentário e de grego/hebraico fica de fora: segue a língua do conteúdo, já tratada pelo núcleo (scriptOf).
import { useMemo } from 'react';
import type { TextStyle } from 'react-native';
import { appLangInfo, type AppLang } from '@sensus/core';
import { useLang } from '../i18n';

/** Papéis de texto (tokens.type) que mostram conteúdo: nunca recebem a direção da interface. */
const CONTENT_VARIANTS: ReadonlySet<string> = new Set([
  'scripture',
  'chapterNumber',
  'verseNumber',
  'excerpt',
  'fullText',
  'claim',
  'greek',
  'lemma',
  'lemmaHero',
  'mono',
]);

export interface UiDirectionOpts {
  /** O idioma do app é da direita para a esquerda (appLangInfo(lang).rtl). */
  rtl: boolean;
  /** Papel tipográfico do texto (tokens.type). Papéis de conteúdo ficam de fora. */
  variant?: string;
  /** Texto de fonte ou bíblico, mesmo que o papel seja de interface. */
  content?: boolean;
  /** Texto centralizado: a direção de escrita vale, o alinhamento não muda. */
  center?: boolean;
}

/**
 * Estilo de direção de um texto da interface. Função pura: sem React e sem store.
 * `textAlign: 'right'` só entra quando o texto não está centralizado; um `style` posterior na composição vence.
 */
export function uiDirectionStyle({ rtl, variant, content, center }: UiDirectionOpts): TextStyle {
  if (!rtl || content || (variant !== undefined && CONTENT_VARIANTS.has(variant))) return {};
  return center ? { writingDirection: 'rtl' } : { writingDirection: 'rtl', textAlign: 'right' };
}

/** Idioma do app é da direita para a esquerda (ar, ur). */
export function langIsRtl(lang: AppLang): boolean {
  return appLangInfo(lang).rtl;
}

/** Direção da interface para um componente: lê o idioma do app e re-renderiza ao trocá-lo. */
export function useUiDirection(opts: Omit<UiDirectionOpts, 'rtl'> = {}): TextStyle {
  const rtl = langIsRtl(useLang());
  const { variant, content, center } = opts;
  return useMemo(() => uiDirectionStyle({ rtl, variant, content, center }), [rtl, variant, content, center]);
}
