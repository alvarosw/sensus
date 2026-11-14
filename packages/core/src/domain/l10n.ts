// Textos curtos (glosas, títulos de verbete e de tópico, nomes): o domínio decide o que mostrar e o que vai ao
// modelo de tradução. Ordem de exibição: pacote (nome em pt) -> tradução pronta -> original. Ver docs/ARCHITECTURE.md §2.
import { langBase, sourceLangOf } from './sources';
import type { AppLang } from './locale';
import type { NameFields } from './names';

/** Língua de token.gloss_en (glosa contextual do TAGNT/TAHOT): sempre inglês. Não passa pela tradução (contrato §2). */
export const TOKEN_GLOSS_LANG = 'en';

/** De onde veio o texto mostrado: banco de pacote, tradução automática ou o original da fonte. */
export type ShownVia = 'pack' | 'machine' | 'original';

/** Texto curto pronto para mostrar. `lang` é a língua do texto mostrado (base BCP-47). */
export interface ShownShortText {
  text: string;
  via: ShownVia;
  lang: string;
}

/** Texto curto antes da tradução. */
export interface ShortText {
  /** O que aparece sem tradução. */
  original: string;
  /** Língua do original (registro de fontes); null = desconhecida, não traduz. */
  lang: string | null;
  /** O que vai ao modelo (pode ser reescrito); null = não traduzir. */
  forMachine: string | null;
  /** Valor do banco na língua (fase 1: só namePt). */
  packValue: { lang: string; value: string } | null;
}

/** Língua assumida do original quando a fonte não diz qual é. */
const ORIGINAL_FALLBACK_LANG = 'en';

/** Palavras que, no fim de "TÓPICO, PARTE DO TÓPICO", pedem a inversão para uma frase natural. */
const TOPIC_TAIL_WORDS: ReadonlySet<string> = new Set([
  'the', 'a', 'an', 'of', 'to', 'toward', 'towards', 'for', 'in', 'on', 'with', 'by', 'from', 'against', 'at',
  'about', 'unto', 'upon', 'into', 'concerning',
]);

/** Texto vazio ou só espaços conta como ausente. */
function present(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

/** Valor de pacote presente (valor e língua não vazios). */
function packOf(p: { lang: string; value: string } | null | undefined): { lang: string; value: string } | null {
  const value = present(p?.value);
  const lang = langBase(p?.lang);
  return value && lang ? { lang, value } : null;
}

/**
 * Texto curto a mostrar: o valor do pacote quando já está no idioma do app; senão a tradução pronta; senão o valor
 * do pacote em outra língua; senão o original da fonte (com a língua dele).
 */
export function shownShortText(input: {
  packValue: { lang: string; value: string } | null;
  original: string;
  machine: string | null;
  appLang: AppLang;
  originalLang?: string | null;
}): ShownShortText {
  const pack = packOf(input.packValue);
  if (pack && pack.lang === input.appLang) return { text: pack.value, via: 'pack', lang: input.appLang };
  const machine = present(input.machine);
  if (machine) return { text: machine, via: 'machine', lang: input.appLang };
  if (pack) return { text: pack.value, via: 'original', lang: pack.lang };
  return {
    text: input.original.trim(),
    via: 'original',
    lang: langBase(input.originalLang) ?? ORIGINAL_FALLBACK_LANG,
  };
}

/** Marca discreta do texto original: a língua dele, só quando o texto é original e de outra língua que a do app. */
export function shortTextMark(shown: { via: ShownVia; lang: string }, appLang: AppLang): string | null {
  if (shown.via !== 'original') return null;
  const lang = langBase(shown.lang);
  return lang && lang !== appLang ? lang : null;
}

/** Título em caixa de título para cabeçalhos de verbete: "CHRIST, OFFICES OF" -> "Christ, Offices of". */
export function titleCaseHeadword(headword: string): string {
  const small = new Set(['of', 'the', 'and', 'to', 'in', 'a', 'an', 'on', 'for', 'de', 'do', 'da', 'e']);
  return headword
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      if (i > 0 && small.has(word)) return word;
      return word.replace(/^([\p{L}])/u, (c) => c.toUpperCase());
    })
    .join(' ');
}

/**
 * Título de tópico para o modelo: "AFFLICTED, DUTY TOWARD THE" -> "Duty toward the Afflicted". Sem inversão, só a
 * caixa de título sai (o modelo costuma corrigir a caixa).
 */
export function topicHeadwordForTranslation(headword: string): string {
  const comma = headword.indexOf(',');
  if (comma >= 0) {
    const head = headword.slice(0, comma).trim();
    const rest = headword.slice(comma + 1).trim();
    const words = rest.split(/\s+/);
    const last = words[words.length - 1]?.toLowerCase() ?? '';
    if (head && TOPIC_TAIL_WORDS.has(last)) {
      // O núcleo mantém caixa de título: nome próprio ("God", "Christ") não vira minúsculo.
      const phrase = `${rest.toLowerCase()} ${titleCaseHeadword(head)}`;
      return phrase.replace(/^\p{L}/u, (c) => c.toUpperCase());
    }
  }
  return titleCaseHeadword(headword.trim());
}

/** Chave de comparação de nomes: NFC, minúsculas, espaços colapsados. */
function nameKey(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Título de verbete ou de tópico. Se o título coincide com o nome de uma entidade do painel, usa o nome em pt dela
 * (sem tradução: o modelo traduz "Job" como "Trabalho"). Senão o título vai ao modelo, quando a fonte tem idioma.
 */
export function headwordShortText(
  headword: string,
  sourceId: string | null,
  names: readonly NameFields[],
  nameLang: string,
): ShortText {
  const original = titleCaseHeadword(headword.trim());
  const lang = sourceLangOf(sourceId);
  const key = nameKey(original);
  const entity = names.find((n) => nameKey(n.name) === key);
  if (entity) {
    const value = present(entity.namePt);
    return { original, lang, forMachine: null, packValue: value ? { lang: nameLang, value } : null };
  }
  return {
    original,
    lang,
    forMachine: lang ? topicHeadwordForTranslation(headword) : null,
    packValue: null,
  };
}

/** Item do token (glosa contextual, sempre inglês, sem tradução). */
function tokenGlossItem(tg: string): ShortText {
  return { original: tg, lang: TOKEN_GLOSS_LANG, forMachine: null, packValue: null };
}

/**
 * Glosa de uma palavra. Com `contextFor` em inglês, a glosa contextual do token; senão a do léxico (traduzível, na
 * língua da fonte); sem léxico, a glosa contextual do token. Nada disponível: null.
 */
export function glossShortText(input: {
  lexicon: { gloss: string | null; source_id: string } | null | undefined;
  tokenGloss: string | null | undefined;
  contextFor?: AppLang;
}): ShortText | null {
  const tg = present(input.tokenGloss);
  const lg = present(input.lexicon?.gloss);
  if (tg && input.contextFor && langBase(input.contextFor) === 'en') return tokenGlossItem(tg);
  if (lg && input.lexicon) {
    const lang = sourceLangOf(input.lexicon.source_id);
    return { original: lg, lang, forMachine: lang ? lg : null, packValue: null };
  }
  return tg ? tokenGlossItem(tg) : null;
}

/**
 * Glosa contextual (popover, cabeçalho do painel da palavra): só o token, e só com o app em inglês ou sem glosa do
 * léxico. Com o app em outra língua e glosa do léxico, a glosa do léxico é a que vale (null aqui).
 */
export function contextGloss(input: {
  tokenGloss: string | null | undefined;
  lexiconGloss: string | null | undefined;
  appLang: AppLang;
}): ShortText | null {
  const tg = present(input.tokenGloss);
  if (!tg) return null;
  if (langBase(input.appLang) === 'en' || !present(input.lexiconGloss)) return tokenGlossItem(tg);
  return null;
}

/**
 * Lote de tradução de um bloco: a língua do primeiro item traduzível e os textos dessa língua, sem repetir, na ordem.
 * Itens de outra língua ficam de fora (cada lote tem uma língua de origem).
 */
export function machineBatch(items: readonly (ShortText | null | undefined)[]): { lang: string | null; texts: string[] } {
  const first = items.find((i) => i && present(i.forMachine) && i.lang);
  const lang = first?.lang ?? null;
  if (!lang) return { lang: null, texts: [] };
  const texts: string[] = [];
  for (const item of items) {
    const text = item && item.lang === lang ? present(item.forMachine) : null;
    if (text && !texts.includes(text)) texts.push(text);
  }
  return { lang, texts };
}
