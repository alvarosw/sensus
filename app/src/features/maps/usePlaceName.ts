// Nome do lugar traduzido no aparelho (língua da fonte -> idioma do app) para o cartão do marcador.
// Só aparece com a tradução ligada e o modelo pronto; senão o cartão mostra o nome da fonte.
import { useEffect, useState } from 'react';
import { sourceLangOf, translationPair } from '@sensus/core';
import { useLang } from '@/i18n/lang-store';
import { cachedTranslation, translateText } from '@/translate/engine';
import { ensureTranslateLoaded, useTranslate } from '@/translate/store';

/** Fonte dos nomes de lugar (em inglês, ver SOURCES). Todas as fontes de lugar são inglês; a língua vem do registro. */
const PLACE_NAME_SOURCE = 'theographic';

/** Tradução do nome, ou null quando a tradução está desligada, indisponível ou ainda não pronta. */
export function usePlaceTranslation(name: string): string | null {
  const loaded = useTranslate((s) => s.loaded);
  const supported = useTranslate((s) => s.supported);
  const enabled = useTranslate((s) => s.enabled);
  const model = useTranslate((s) => s.model);
  const pair = translationPair(sourceLangOf(PLACE_NAME_SOURCE), useLang());
  const ready = loaded && supported && enabled && model === 'ready' && pair !== null && name.trim().length > 0;
  const cached = ready && pair ? cachedTranslation(name, pair) : null;
  const [fresh, setFresh] = useState<{ name: string; out: string } | null>(null);

  useEffect(() => {
    ensureTranslateLoaded();
  }, []);

  useEffect(() => {
    if (!ready || cached !== null) return undefined;
    let alive = true;
    if (!pair) return undefined;
    translateText(name, pair)
      .then((out) => alive && setFresh({ name, out }))
      .catch(() => alive && setFresh(null));
    return () => {
      alive = false;
    };
  }, [ready, name, cached, pair?.to]);

  if (!ready) return null;
  if (cached !== null) return cached;
  return fresh && fresh.name === name ? fresh.out : null;
}

/** Título do cartão: "Filipos · Philippi" com tradução pronta; senão só o nome da fonte. */
export function placeTitle(source: string, translated: string | null): string {
  if (!translated || translated.trim().length === 0) return source;
  if (translated.trim().toLowerCase() === source.trim().toLowerCase()) return source;
  return `${translated.trim()} · ${source}`;
}
