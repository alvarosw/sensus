// Salmos 119:105 em cada idioma do app, com a referência da Bíblia de onde vem o texto (ver docs/design/onboarding.md).
// Fica fora das tabelas de tradução: é texto de fonte. O indonésio não tem Bíblia livre no catálogo, então o versículo
// vem em inglês (WEB) e a referência diz isso.
import type { AppLang } from '@sensus/core';

export interface VerseText {
  verse: string;
  reference: string;
}

const VERSES: Record<AppLang, VerseText> = {
  pt: { verse: 'Tua palavra é lâmpada para meus pés e luz para meu caminho.', reference: 'Salmos 119:105 · BLivre' },
  en: { verse: 'Your word is a lamp to my feet, and a light for my path.', reference: 'Psalm 119:105 · WEB' },
  es: { verse: 'Lámpara es a mis pies tu palabra, y lumbrera a mi camino.', reference: 'Salmos 119:105 · BLM' },
  fr: { verse: 'Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.', reference: 'Psaume 119:105 · SBL' },
  de: { verse: 'Dein Wort ist Leuchte meinem Fuße und Licht für meinen Pfad.', reference: 'Psalm 119,105 · ELO' },
  ru: { verse: 'Слово Твое — светильник ноге моей и свет стезе моей.', reference: 'Псалом 118:105 · Синодальный' },
  zh: { verse: '你的话是我脚前的灯，是我路上的光。', reference: '诗篇 119:105 · 当代译本' },
  ja: { verse: 'あなたの言葉は私の足のともしび、私の道の光である。', reference: '詩篇 119:105 · FB' },
  hi: { verse: 'तेरा वचन मेरे पाँव के लिये दीपक, और मेरे मार्ग के लिये उजियाला है।', reference: 'भजन संहिता 119:105 · IRV' },
  bn: { verse: 'তোমার বাক্য আমার চরণের প্রদীপ, এবং আমার চলার পথের আলো।', reference: 'গীতসংহিতা 119:105 · OBCV' },
  ur: { verse: 'آپ کا کلام میرے قدموں کے لیٔے چراغ، اَور میری راہ کے لیٔے رَوشنی ہے۔', reference: 'زبور 119:105 · OUCV' },
  ar: { verse: 'سراج لرجلي كلامك ونور لسبيلي.', reference: 'مزمور 119:105 · فاندايك' },
  id: { verse: 'Your word is a lamp to my feet, and a light for my path.', reference: 'Mazmur 119:105 · WEB' },
  vi: { verse: 'Lời Chúa là đèn soi bước chân con, là ánh sáng cho đường con bước.', reference: 'Thi Thiên 119:105 · VCB' },
};

/** Versículo e referência do idioma pedido (um para cada um dos 14 idiomas). */
export function verseOf(lang: AppLang): VerseText {
  return VERSES[lang];
}
