// Palavra que move o trecho (lente Língua do fio): escolha pura entre a IA e os fallbacks do banco.
// Ordem: (1) a IA escolheu (linha "=" de @lingua); (2) a IA desenvolveu @lingua mas não marcou a palavra:
// a primeira citada no desenvolvimento; (3) a mais mencionada nos comentários do trecho; (4) o hápax;
// (5) um verbo. Sem IA, ou com erro, começa em (3). Sem nenhuma palavra possível, não há escolha.
import {
  isProperNameToken,
  isVerbToken,
  langOfToken,
  lexiconByBase,
  type Block,
  type Commentary,
  type Lang,
  type LexiconEntry,
  type PanelData,
  type StrongBase,
  type Token,
  type Vid,
} from '@sensus/core';
import { isKeyToken } from './format';

export type WordBy = 'ai' | 'section' | 'commentary' | 'hapax' | 'verb';

export interface WordPick {
  /** Token que representa a palavra (o cite_id dele vai para a evidência). */
  token: Token;
  by: WordBy;
  /** Menções nos comentários do trecho (só quando by é 'commentary'). */
  mentions?: number;
}

export type WordChoice = { state: 'pending' } | { state: 'none' } | { state: 'picked'; pick: WordPick };

/** Estado da IA para a escolha: `active` = configurada e sem erro; `linguaDone` = @lingua já terminou. */
export interface WordAi {
  active: boolean;
  /** cite_id do token escolhido pela IA (linha "=" de @lingua), se já chegou. */
  keyWordCiteId: string | null;
  /** cite_ids citados no desenvolvimento de @lingua, em ordem de aparição (ver citedIdsOf). */
  linguaCiteIds: readonly string[];
  linguaDone: boolean;
}

interface Range {
  start: Vid;
  end: Vid;
}

/** Palavra de conteúdo do trecho, agrupada pelo strong_base (ordem do texto). */
interface WordGroup {
  strongBase: string;
  /** Primeiro token do grupo no trecho: representa a palavra. */
  token: Token;
  /** Ocorrências no trecho. */
  occurrences: number;
  /** Versículos com a palavra, no testamento dela (concordância); 0 = desconhecido. */
  count: number;
  verb: boolean;
  /** Formas comparáveis: lema, superfícies, transliterações (do token e do verbete). Nunca a glosa em inglês. */
  forms: Set<string>;
}

/** Forma comparável: sem acentos e diacríticos, minúscula, sigma final como σ. */
export function normalizeForm(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ς/g, 'σ');
}

/** Contagem de palavras (só letras, normalizadas) nos textos. */
export function wordCounts(texts: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const w of normalizeForm(text).match(/\p{L}+/gu) ?? []) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return counts;
}

function formsOf(strings: ReadonlyArray<string | null | undefined>): string[] {
  return strings
    .filter((s): s is string => !!s)
    .map((s) => normalizeForm(s).replace(/\P{L}/gu, ''))
    .filter(Boolean);
}

function inRange(vid: Vid, range: Range): boolean {
  return vid >= range.start && vid <= range.end;
}

/** Formas com menos letras que isto não entram na contagem de comentários (evita "en", "kai" etc.). */
export const MIN_FORM_LETTERS = 4;

/**
 * Grupos de palavras de conteúdo do trecho, na ordem do texto. Nomes próprios (domínio: TAGNT e TAHOT) ficam de
 * fora, salvo com `withNames` (só a leitura de uma palavra já citada pela IA, o fallback 1, aceita nomes).
 */
function groupsOf(panel: PanelData, range: Range, withNames = false): WordGroup[] {
  const byBase = new Map<string, WordGroup>();
  for (const t of panel.layers.text.original) {
    if (!inRange(t.vid, range) || !isKeyToken(t) || (!withNames && isProperNameToken(t))) continue;
    const sb = t.strong_base!;
    let g = byBase.get(sb);
    if (!g) {
      g = {
        strongBase: sb,
        token: t,
        occurrences: 0,
        count: panel.layers.language.concordance[sb]?.count ?? 0,
        verb: false,
        forms: new Set(),
      };
      byBase.set(sb, g);
    }
    g.occurrences++;
    if (isVerbToken(t)) g.verb = true;
    for (const f of formsOf([t.lemma, t.surface, t.translit])) g.forms.add(f);
  }
  // Verbete por base (o grupo agrupa as ocorrências de uma base): um por língua, calculado uma vez.
  const byLang = new Map<Lang, Map<StrongBase, LexiconEntry>>();
  for (const g of byBase.values()) {
    const lang = langOfToken(g.token);
    let lex = byLang.get(lang);
    if (!lex) {
      lex = lexiconByBase(panel.layers.language.lexicon, lang);
      byLang.set(lang, lex);
    }
    const l: LexiconEntry | undefined = lex.get(g.strongBase as StrongBase);
    for (const f of formsOf([l?.lemma, l?.translit])) g.forms.add(f);
  }
  return [...byBase.values()];
}

/**
 * cite_ids citados num desenvolvimento (blocos do resumo), em ordem: citações válidas e tokens grego/hebraico
 * que a IA escreveu. Usado para a escolha de fallback quando a IA não marcou a palavra.
 */
export function citedIdsOf(blocks: readonly Block[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    const groups = b.type === 'list' ? b.items.map((i) => i.inlines) : [b.inlines];
    for (const inlines of groups) {
      for (const inl of inlines) {
        if (inl.type === 'original' && inl.tokenCiteId) out.push(inl.tokenCiteId);
        if (inl.type === 'cite') for (const r of inl.refs) if (r.valid) out.push(...(r.citeIds ?? [r.citeId]));
      }
    }
  }
  return out;
}

/** Primeiro token do trecho citado no desenvolvimento; se só houver lex:, o grupo do mesmo Strong (nomes incluídos). */
function citedToken(ids: readonly string[], tokens: readonly Token[], groups: readonly WordGroup[]): Token | undefined {
  for (const id of ids) {
    if (!id.startsWith('tok:')) continue;
    const t = tokens.find((x) => x.cite_id === id);
    if (t) return t;
  }
  for (const id of ids) {
    if (!id.startsWith('lex:')) continue;
    const base = /([GH]\d+)[A-Z]?$/.exec(id)?.[1];
    const g = groups.find((x) => x.strongBase === base);
    if (g) return g.token;
  }
  return undefined;
}

/** Palavra mais mencionada nos comentários que cobrem o trecho; empate: a primeira no texto. */
function mostMentioned(groups: readonly WordGroup[], commentaries: readonly Commentary[]): WordPick | undefined {
  const counts = wordCounts(commentaries.map((c) => c.text));
  let best: { g: WordGroup; mentions: number } | undefined;
  for (const g of groups) {
    let mentions = 0;
    for (const f of g.forms) if (f.length >= MIN_FORM_LETTERS) mentions += counts.get(f) ?? 0;
    if (mentions > 0 && (!best || mentions > best.mentions)) best = { g, mentions };
  }
  return best ? { token: best.g.token, by: 'commentary', mentions: best.mentions } : undefined;
}

/** Verbo do trecho: o mais repetido no trecho; no empate, o mais raro no seu testamento. */
function mostRepeatedVerb(groups: readonly WordGroup[]): WordPick | undefined {
  const verbs = groups
    .filter((g) => g.verb)
    .sort((a, b) => b.occurrences - a.occurrences || (a.count || 9999) - (b.count || 9999));
  const v = verbs[0];
  return v ? { token: v.token, by: 'verb' } : undefined;
}

/**
 * Escolhe a palavra do passo. Com IA ativa e sem escolha, espera (pending) até @lingua terminar; depois
 * aplica os fallbacks. Um token da IA fora do trecho não conta como escolha.
 */
export function chooseKeyWord(panel: PanelData, range: Range, ai: WordAi): WordChoice {
  const tokens = panel.layers.text.original.filter((t) => inRange(t.vid, range));
  const groups = groupsOf(panel, range);
  const withNames = groupsOf(panel, range, true);
  if (ai.active) {
    const chosen = ai.keyWordCiteId ? tokens.find((t) => t.cite_id === ai.keyWordCiteId) : undefined;
    if (chosen) return { state: 'picked', pick: { token: chosen, by: 'ai' } };
    if (!ai.linguaDone) return { state: 'pending' };
    const cited = citedToken(ai.linguaCiteIds, tokens, withNames);
    if (cited) return { state: 'picked', pick: { token: cited, by: 'section' } };
  }
  const covering = panel.layers.interpretation.commentaries.filter((c) => c.start_vid <= range.end && c.end_vid >= range.start);
  const hapax = groups.find((g) => g.count === 1);
  const pick =
    mostMentioned(groups, covering) ??
    (hapax ? { token: hapax.token, by: 'hapax' as const } : undefined) ??
    mostRepeatedVerb(groups);
  return pick ? { state: 'picked', pick } : { state: 'none' };
}
