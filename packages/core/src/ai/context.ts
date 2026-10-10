// Serialização do painel em texto de contexto para o LLM, com orçamento por camada.
import type { Commentary, LexiconEntry, PanelData, Token } from '../types';
import { formatReference } from '../refs';
import { hasEdition, missingBaseEditions } from '../panel';
import { isContentToken } from '../morph';
import { variantSites } from '../variants';

export { isContentToken } from '../morph';

export interface SerializedContext {
  /** Texto estruturado, agrupado nas seis camadas. */
  text: string;
  /** cite_ids efetivamente incluídos no texto (únicos aceitos na validação). */
  citeIds: Set<string>;
  /** Quantidade de registros omitidos por falta de orçamento. */
  omitted: number;
}

export const DEFAULT_CONTEXT_BUDGET = 60_000;

/** Fração do orçamento de cada camada. Parcela não usada vai para as camadas que ficaram sem espaço. */
export const LAYER_SHARES = {
  1: 0.2,
  2: 0.1,
  3: 0.1,
  4: 0.25,
  5: 0.1,
  6: 0.25,
} as const;

const COMMENTARY_CLIP = 900;
const LEXICON_BRIEF_CLIP = 400;
const LEXICON_LONG_CLIP = 800;
const DICTIONARY_CLIP = 500;
const TOPIC_CLIP = 400;
const XREF_CLIP = 500;
const CONCORDANCE_CLIP = 400;
const BOOK_INTRO_CLIP = 700;

/** Léxicos longos: entram só truncados e só para palavras de conteúdo. */
const LONG_LEXICON_SOURCES: ReadonlySet<string> = new Set(['stepbible-tflsj']);

type Layer = 1 | 2 | 3 | 4 | 5 | 6;

const LAYER_TITLES: Record<Layer, string> = {
  1: 'Camada 1 — Texto (traduções, texto original e variantes)',
  2: 'Camada 2 — Contexto literário',
  3: 'Camada 3 — Contexto histórico-cultural',
  4: 'Camada 4 — Língua original',
  5: 'Camada 5 — Intertextualidade',
  6: 'Camada 6 — História da interpretação',
};

interface Item {
  citeId: string;
  layer: Layer;
  section: string;
  sectionOrder: number;
  /** Prioridade dentro da camada (menor = mais importante). */
  priority: number;
  /** Ordem de exibição (documento). */
  seq: number;
  /** Ordem de seleção dentro da prioridade (menor primeiro). */
  pick: number;
  line: string;
  /** Incluído sempre, mesmo acima da fração da camada (ex.: léxico breve de cada palavra). */
  mandatory?: boolean;
  /** Citações adicionais da mesma linha (ex.: leituras de uma variante, cada uma com seu token). */
  cites?: string[];
}

const itemCites = (item: Item): string[] => [item.citeId, ...(item.cites ?? [])];

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * Corta um texto em um número de caracteres, preferindo o fim de uma sentença.
 * Se a primeira sentença já for longa demais, corta no meio e acrescenta "…".
 */
export function clipBySentence(text: string, max: number): string {
  const t = collapse(text);
  if (t.length <= max) return t;
  const sentences = t.split(/(?<=[.!?…])\s+/);
  let out = '';
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > max - 1) break;
    out = next;
  }
  if (!out) return `${t.slice(0, max - 1).trimEnd()}…`;
  return `${out}…`;
}

function describeToken(t: Token, withMorph = true): string {
  const parts = [t.surface];
  if (t.translit) parts.push(`translit. ${t.translit}`);
  if (t.lemma) parts.push(`lema ${t.lemma}`);
  if (t.strong) parts.push(`Strong ${t.strong}`);
  if (withMorph && t.morph) parts.push(`morfologia ${t.morph}${t.morph_desc ? ` (${t.morph_desc})` : ''}`);
  if (t.gloss_en) parts.push(`glosa "${t.gloss_en}"`);
  return parts.join(' · ');
}

function isLongLexicon(l: LexiconEntry): boolean {
  return LONG_LEXICON_SOURCES.has(l.source_id);
}

const TYPE_LABEL: Record<string, string> = {
  person: 'pessoa',
  place: 'lugar',
  event: 'evento',
  group: 'grupo',
  other: 'outro',
};

/** Título curto para a linha de citação: "TBESG - Translators Brief..." vira "TBESG". */
export function shortTitle(title: string): string {
  if (title.length <= 40) return title;
  const head = title.split(/ - | \(/)[0]?.trim();
  return head && head.length >= 2 ? head : title.slice(0, 40);
}

function buildItems(panel: PanelData): Item[] {
  const items: Item[] = [];
  const titleOf = (sourceId: string): string => {
    const title = panel.sources[sourceId]?.title ?? sourceId;
    return shortTitle(title);
  };
  const push = (item: Omit<Item, 'seq' | 'pick'> & { pick?: number }): void => {
    const seq = items.length;
    items.push({ ...item, seq, pick: item.pick ?? seq });
  };

  // Camada 1 — texto
  const { translations, original } = panel.layers.text;
  for (const v of translations) {
    push({
      citeId: v.cite_id,
      layer: 1,
      section: 'Traduções',
      sectionOrder: 1,
      priority: 1,
      line: `[${v.cite_id}] ${titleOf(v.source_id)}: ${collapse(v.text)}`,
    });
  }

  // Texto-base: palavras presentes no TR (hebraico: todas). Palavras de conteúdo mostram a morfologia
  // completa na camada 4; aqui ficam só a forma e o lema.
  for (const t of original) {
    if (t.corpus === 'gnt' && !hasEdition(t, 'TR')) continue; // aparece nas leituras de variante
    const notes: string[] = [];
    const missing = missingBaseEditions(t);
    if (t.corpus === 'gnt' && missing.length > 0) {
      notes.push(`edições: ${t.editions}`, `ausente em ${missing.join(', ')}`);
      if (t.variant_note) notes.push(`nota: ${t.variant_note}`);
    }
    push({
      citeId: t.cite_id,
      layer: 1,
      section: 'Texto original (base TR; hebraico completo)',
      sectionOrder: 2,
      priority: 1,
      line: `[${t.cite_id}] ${titleOf(t.source_id)}: ${[describeToken(t, !isContentToken(t)), ...notes].join(' · ')}`,
    });
  }

  // Variantes: leituras por sítio (lacunas entre palavras comuns a TR, BYZ e NA). Cada leitura cita os seus tokens.
  for (const site of variantSites(original)) {
    const cites = [...new Set(site.readings.flatMap((r) => r.tokens.map((t) => t.cite_id)))];
    const fmt = (list: Token[]): string =>
      list.length === 0
        ? '—omite—'
        : list
            .map(
              (t) =>
                `${t.surface} [${t.cite_id}] (morfologia ${t.morph ?? '-'}${t.morph_desc ? ` = ${t.morph_desc}` : ''})`,
            )
            .join(' + ');
    const readings = site.readings.map((r) => `${r.editions.join('/')}: ${fmt(r.tokens)}`).join(' | ');
    push({
      citeId: cites[0] ?? '',
      cites: cites.slice(1),
      layer: 1,
      section: 'Variantes textuais (leituras alinhadas por lacuna)',
      sectionOrder: 3,
      priority: 1,
      mandatory: true,
      line: `Variante em ${site.ref} — ${readings}`,
    });
  }

  // Camada 2 — contexto literário
  const { before, after, divisions, bookIntro } = panel.layers.literary;
  const verseCites = new Set([...translations, ...before, ...after].map((v) => v.cite_id));
  for (const v of [...before, ...after]) {
    push({
      citeId: v.cite_id,
      layer: 2,
      section: 'Versículos vizinhos',
      sectionOrder: 1,
      priority: 1,
      line: `[${v.cite_id}] ${titleOf(v.source_id)}: ${collapse(v.text)}`,
    });
  }
  for (const d of divisions) {
    // Divisões não têm cite_id próprio: são citadas pelo versículo em que começam, se ele estiver no contexto.
    const citeId = `txt:${d.source_id}:${d.vid}`;
    if (!verseCites.has(citeId)) continue;
    const what = d.kind === 'heading' ? `título de seção "${d.title ?? 'sem título'}"` : 'início de parágrafo';
    push({
      citeId,
      layer: 2,
      section: 'Divisões de seção',
      sectionOrder: 2,
      priority: 1,
      line: `[${citeId}] ${titleOf(d.source_id)}: ${what}`,
    });
  }
  for (const d of bookIntro) {
    push({
      citeId: d.cite_id,
      layer: 2,
      section: 'Introdução ao livro',
      sectionOrder: 3,
      priority: 2,
      line: `[${d.cite_id}] ${titleOf(d.source_id)}: ${d.headword} — ${clipBySentence(d.text, BOOK_INTRO_CLIP)}`,
    });
  }

  // Camada 3 — contexto histórico-cultural
  for (const d of panel.layers.historical.dictionary) {
    push({
      citeId: d.cite_id,
      layer: 3,
      section: 'Dicionários bíblicos',
      sectionOrder: 1,
      priority: 1,
      line: `[${d.cite_id}] ${titleOf(d.source_id)}: ${d.headword} — ${clipBySentence(d.text, DICTIONARY_CLIP)}`,
    });
  }
  for (const e of panel.layers.historical.entities) {
    const desc = e.description ? ` — ${clipBySentence(e.description, 300)}` : '';
    push({
      citeId: e.cite_id,
      layer: 3,
      section: 'Pessoas, lugares e grupos',
      sectionOrder: 2,
      priority: 2,
      line: `[${e.cite_id}] ${titleOf(e.source_id)}: ${e.name} (${TYPE_LABEL[e.type] ?? e.type})${desc}`,
    });
  }

  // Camada 4 — língua original
  // Palavras de conteúdo com análise morfológica completa (código e descrição TEGMC), com a sua citação.
  for (const t of original) {
    if (!isContentToken(t) || !(t.corpus === 'hot' || hasEdition(t, 'TR'))) continue;
    const morph = t.morph ? `morfologia ${t.morph}${t.morph_desc ? ` = ${t.morph_desc}` : ''}` : 'morfologia -';
    push({
      citeId: t.cite_id,
      layer: 4,
      section: 'Palavras de conteúdo (análise morfológica)',
      sectionOrder: 0,
      priority: 1,
      mandatory: true,
      line: `[${t.cite_id}] ${titleOf(t.source_id)}: ${t.surface} · lema ${t.lemma ?? '-'} · Strong ${t.strong ?? '-'} · ${morph}${t.gloss_en ? ` · glosa "${t.gloss_en}"` : ''}`,
    });
  }

  // Palavras de conteúdo: bases de Strong com ao menos uma ocorrência de conteúdo no trecho.
  const contentBases = new Set(
    original.filter(isContentToken).map((t) => t.strong_base).filter((b): b is string => !!b),
  );
  const countOf = (base: string | null): number => (base ? (panel.layers.language.concordance[base]?.count ?? 0) : 0);
  for (const l of panel.layers.language.lexicon) {
    const long = isLongLexicon(l);
    // Léxico breve vale para toda palavra; o longo só para palavras de conteúdo.
    if (long && !(l.strong_base && contentBases.has(l.strong_base))) continue;
    const head = `${l.key}${l.translit ? ` (${l.translit})` : ''}`;
    const gloss = l.gloss ? ` — glosa: ${l.gloss}.` : '';
    const def = clipBySentence(l.definition, long ? LEXICON_LONG_CLIP : LEXICON_BRIEF_CLIP);
    push({
      citeId: l.cite_id,
      layer: 4,
      section: 'Léxico (Strong)',
      sectionOrder: 1,
      priority: long ? 2 : 1,
      mandatory: !long,
      // Hápax e palavras raras primeiro: menos ocorrências, mais pedidos de léxico quando o orçamento aperta.
      pick: countOf(l.strong_base),
      line: `[${l.cite_id}] ${titleOf(l.source_id)}: ${head}${gloss} ${def}`,
    });
  }
  for (const [base, c] of Object.entries(panel.layers.language.concordance)) {
    for (const s of c.samples) {
      push({
        citeId: s.cite_id,
        layer: 4,
        section: 'Concordância (ocorrências no texto-base)',
        sectionOrder: 2,
        priority: 3,
        pick: c.count,
        line: `[${s.cite_id}] ${titleOf(s.source_id)}: (${base}: ${c.count} versículos no total) ${collapse(s.text).slice(0, CONCORDANCE_CLIP)}`,
      });
    }
  }

  // Camada 5 — intertextualidade
  for (const x of panel.layers.intertext.xrefs) {
    const target = formatReference({ start: x.to_start_vid, end: x.to_end_vid });
    const weight = x.weight === null ? '' : ` (peso ${x.weight})`;
    const body =
      x.texts.length > 0
        ? clipBySentence(x.texts.map((v) => v.text).join(' '), XREF_CLIP)
        : '(texto não disponível no texto-base)';
    push({
      citeId: x.cite_id,
      layer: 5,
      section: 'Referências cruzadas',
      sectionOrder: 1,
      priority: 1,
      line: `[${x.cite_id}] ${titleOf(x.source_id)}: destino ${target}${weight} — ${body}`,
    });
  }
  for (const d of panel.layers.intertext.topics) {
    push({
      citeId: d.cite_id,
      layer: 5,
      section: 'Índices temáticos',
      sectionOrder: 2,
      priority: 2,
      line: `[${d.cite_id}] ${titleOf(d.source_id)}: ${d.headword} — ${clipBySentence(d.text, TOPIC_CLIP)}`,
    });
  }

  // Camada 6 — história da interpretação
  // Round-robin entre fontes: a k-ésima entrada de cada fonte vem antes da (k+1)-ésima de qualquer fonte.
  const commentaries: Commentary[] = panel.layers.interpretation.commentaries;
  const sourceOrder = new Map(
    [...new Set(commentaries.map((c) => c.source_id))].sort().map((id, i) => [id, i] as const),
  );
  const rankInSource = new Map<string, number>();
  for (const c of commentaries) {
    const rank = rankInSource.get(c.source_id) ?? 0;
    rankInSource.set(c.source_id, rank + 1);
    const tradition = panel.sources[c.source_id]?.tradition ?? 'não informada';
    push({
      citeId: c.cite_id,
      layer: 6,
      section: 'Comentários por tradição',
      sectionOrder: 1,
      priority: 1,
      pick: rank * 1000 + (sourceOrder.get(c.source_id) ?? 0),
      line: `[${c.cite_id}] ${titleOf(c.source_id)} (tradição: ${tradition}): ${clipBySentence(c.text, COMMENTARY_CLIP)}`,
    });
  }

  return items;
}

const byOrder = (a: Item, b: Item): number => a.priority - b.priority || a.pick - b.pick || a.seq - b.seq;
const costOf = (item: Item): number => item.line.length + 3; // "- " + quebra de linha

/**
 * Escolhe itens de uma camada dentro de `allowance`. O primeiro item é sempre incluído (cada camada
 * não vazia tem pelo menos um registro). Depois, por prioridade: se um item não cabe, nenhum item de
 * prioridade menor entra, mas itens da mesma prioridade ainda podem caber.
 */
function selectWithin(items: Item[], allowance: number): { chosen: Item[]; used: number } {
  const order = [...items].sort(byOrder);
  const chosen: Item[] = [];
  let used = 0;
  let blocked = Number.POSITIVE_INFINITY;
  for (const item of order) {
    const cost = costOf(item);
    if (chosen.length === 0 || item.mandatory) {
      chosen.push(item);
      used += cost;
      continue;
    }
    if (item.priority > blocked) continue;
    if (used + cost > allowance) {
      blocked = Math.min(blocked, item.priority);
      continue;
    }
    chosen.push(item);
    used += cost;
  }
  return { chosen, used };
}

/**
 * Seleção por camada: cada camada recebe LAYER_SHARES × orçamento. Camadas que ainda têm itens
 * fora do orçamento recebem, em proporção às suas frações, a parcela que sobrou das outras.
 */
function selectByLayer(items: Item[], budget: number): Item[] {
  // Itens obrigatórios entram sempre; o restante do orçamento é dividido por camada.
  const mandatory = items.filter((i) => i.mandatory);
  const remaining = Math.max(0, budget - mandatory.reduce((sum, i) => sum + costOf(i), 0));
  const optional = items.filter((i) => !i.mandatory);
  const layers: Layer[] = [1, 2, 3, 4, 5, 6];
  const byLayer = new Map<Layer, Item[]>(layers.map((l) => [l, optional.filter((i) => i.layer === l)] as const));
  const allowance = new Map<Layer, number>(layers.map((l) => [l, remaining * LAYER_SHARES[l]] as const));

  const first = new Map<Layer, ReturnType<typeof selectWithin>>();
  for (const l of layers) first.set(l, selectWithin(byLayer.get(l) ?? [], allowance.get(l) ?? 0));

  let spare = 0;
  for (const l of layers) spare += Math.max(0, (allowance.get(l) ?? 0) - (first.get(l)?.used ?? 0));
  const exhausted = layers.filter((l) => (first.get(l)?.chosen.length ?? 0) < (byLayer.get(l)?.length ?? 0));
  const exhaustedShare = exhausted.reduce((sum, l) => sum + LAYER_SHARES[l], 0);

  const chosen: Item[] = [...mandatory];
  for (const l of layers) {
    if (exhausted.includes(l) && spare > 0 && exhaustedShare > 0) {
      const extra = (spare * LAYER_SHARES[l]) / exhaustedShare;
      chosen.push(...selectWithin(byLayer.get(l) ?? [], (allowance.get(l) ?? 0) + extra).chosen);
    } else {
      chosen.push(...(first.get(l)?.chosen ?? []));
    }
  }
  return chosen;
}

function render(panel: PanelData, chosen: Item[], all: Item[], omitted: number): string {
  const out: string[] = [
    `# Passagem: ${panel.reference}`,
    'Dados do banco Sensus. Cite somente os cite_ids entre colchetes.',
  ];
  const layers: Layer[] = [1, 2, 3, 4, 5, 6];
  const unit = panel.layers.literary.unit;
  for (const layer of layers) {
    const inLayer = chosen
      .filter((i) => i.layer === layer)
      .sort((a, b) => a.sectionOrder - b.sectionOrder || a.seq - b.seq);
    const unitLine =
      layer === 2 && unit
        ? `Unidade literária (divisão de texto que contém o trecho): ${formatReference(unit)}. Sem id citável: delimita o parágrafo.`
        : null;
    if (inLayer.length === 0 && !unitLine) continue;
    out.push('', `## ${LAYER_TITLES[layer]}`);
    if (unitLine) {
      out.push('### Unidade literária', `- ${unitLine}`);
    }
    let section = '';
    for (const item of inLayer) {
      if (item.section !== section) {
        section = item.section;
        out.push(`### ${section}`);
      }
      out.push(`- ${item.line}`);
    }
  }
  const missing = layers.filter((layer) => !all.some((i) => i.layer === layer));
  if (missing.length > 0) {
    out.push('', `Sem registros no banco para: ${missing.map((l) => `camada ${l}`).join(', ')}.`);
  }
  if (omitted > 0) {
    out.push(`(${omitted} registros adicionais foram omitidos por limite de tamanho do contexto.)`);
  }
  return out.join('\n');
}

/**
 * Serializa o painel em texto estruturado (cite_ids entre colchetes) respeitando `budgetChars`.
 * O orçamento é dividido por camada (LAYER_SHARES); dentro de cada camada, o corte segue a prioridade.
 * Comentários e léxico: round-robin/raridade; itens longos são cortados por sentença com "…".
 */
export function serializePanel(panel: PanelData, budgetChars: number = DEFAULT_CONTEXT_BUDGET): SerializedContext {
  const items = buildItems(panel);
  let budget = budgetChars;
  let chosen: Item[] = [];
  let text = '';

  // Cabeçalhos e avisos ocupam espaço fora do orçamento dos itens: ajusta até caber.
  for (let attempt = 0; attempt < 8; attempt++) {
    chosen = selectByLayer(items, budget);
    text = render(panel, chosen, items, items.length - chosen.length);
    if (text.length <= budgetChars) break;
    budget -= text.length - budgetChars + 64;
    if (budget <= 0) break;
  }
  // Orçamento muito pequeno para os obrigatórios: mantém só eles (acima do orçamento, sem perder o essencial).
  if (text.length > budgetChars) {
    chosen = selectByLayer(items, 0);
    text = render(panel, chosen, items, items.length - chosen.length);
  }

  return {
    text,
    citeIds: new Set(chosen.flatMap(itemCites)),
    omitted: items.length - chosen.length,
  };
}
