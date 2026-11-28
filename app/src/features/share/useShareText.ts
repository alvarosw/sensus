// Texto da prévia: lê os versículos do trecho na Bíblia pedida e monta o texto com o modelo; a síntese já vem pronta.
import { useEffect, useState } from 'react';
import { bibleAbbr } from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { useBibles } from '@/data/bibles/bibles-store';
import { useLang } from '@/i18n/lang-store';
import { useAppPrefs } from '@/settings/app-prefs';
import { shareRef, verseShareText, type ShareVerse } from './share-model';
import type { ShareRequest } from './share-store';

export interface ShareText {
  /** null enquanto os versículos carregam (ou se falharam). */
  text: string | null;
  error: boolean;
  /** Referência com a sigla ("Fp 2:5–8 (BLivre)") ou a da síntese. */
  title: string;
}

export function useShareText(request: ShareRequest | null): ShareText {
  const repo = useRepo();
  const lang = useLang();
  const catalog = useBibles((s) => s.catalog);
  const numbers = useAppPrefs((s) => s.shareVerseNumbers);
  const verses = request?.kind === 'verses' ? request : null;
  const key = verses ? `${verses.source}:${verses.start}-${verses.end}` : null;
  const [loaded, setLoaded] = useState<{ key: string; verses: ShareVerse[] | null } | null>(null);

  useEffect(() => {
    if (!verses || !key) return;
    let alive = true;
    repo.verseTexts(verses.source, { start: verses.start, end: verses.end }).then(
      (rows) => alive && setLoaded({ key, verses: rows.map((r) => ({ vid: r.vid, text: r.text })) }),
      () => alive && setLoaded({ key, verses: null }),
    );
    return () => {
      alive = false;
    };
    // `verses` muda de identidade a cada pedido; a chave diz se o trecho mudou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, key]);

  if (!request) return { text: null, error: false, title: '' };
  if (request.kind === 'synth') return { text: request.text, error: false, title: request.ref };
  const bible = bibleAbbr(request.source, catalog);
  const title = `${shareRef(request.start, request.end, lang)} (${bible})`;
  const rows = loaded?.key === key ? loaded.verses : undefined;
  if (rows === undefined) return { text: null, error: false, title };
  if (rows === null || rows.length === 0) return { text: null, error: true, title };
  return { text: verseShareText({ verses: rows, start: request.start, end: request.end, bible, numbers, lang }), error: false, title };
}
