// Curiosidade do trecho: no máximo UMA nota (tipo eco ou termo) e só quando o contexto a sustenta.
// Três filtros em série: (1) o prompt pode responder "@nenhuma"; (2) o portão em código (acceptCuriosity);
// (3) uma segunda chamada ao modelo, como revisor rígido que por padrão reprova (curiosityReviewMessages).
import type { ChatMessage, VerseRange } from '../types';
import { formatReference } from '../refs';
import { buildSystemPrompt, type PromptOptions } from './prompts';
import { markerKey } from './structured';
import type { RichTextContext } from './structured-types';

/** Versão do prompt da curiosidade: muda quando o texto muda, para invalidar o cache. */
export const CURIOSITY_PROMPT_VERSION = 'curiosidade-v1';
/** Limites de saída. Modelos com raciocínio gastam parte do limite antes de responder, por isso são folgados. */
export const CURIOSITY_MAX_TOKENS = 900;
export const CURIOSITY_REVIEW_MAX_TOKENS = 400;

/** Chave de cache da curiosidade de uma unidade literária (mesmo estilo de summaryCacheKey). */
export function curiosityCacheKey(range: VerseRange): string {
  return `curiosity:${CURIOSITY_PROMPT_VERSION}:${range.start}-${range.end}`;
}

const CURIOSITY_INSTRUCTION = [
  'Procure no contexto UMA curiosidade do trecho que um leitor de hoje provavelmente não sabe e que muda a forma de entendê-lo. Só valem dois tipos:',
  '- eco: o texto alude claramente a algo que os primeiros ouvintes ou leitores conheciam (um texto bíblico anterior que eles conheciam, ou um costume, fato histórico, geográfico ou cultural da época) e, sabendo disso, entendemos o trecho como eles entendiam.',
  '- termo: uma palavra, termo ou frase do trecho tem no original um sentido diferente do que normalmente se entende hoje, e essa diferença muda a leitura.',
  '',
  'Critérios (todos obrigatórios):',
  '- A alusão ou o sentido estão atestados por pelo menos duas entradas do contexto (cite os cite_id); nada de memória própria.',
  '- É específica deste trecho; não serve para qualquer passagem.',
  '- Muda a compreensão; não é só um dado (contagem de ocorrências, hápax, autoria, data, existência de uma referência cruzada, etimologia sem efeito no sentido).',
  '- Não é leitura disputada apresentada como fato; não é inferência; não é aplicação.',
  '- Não exagera: sem "incrível", "chocante", "segredo", "ninguém sabe", pontos de exclamação ou suspense.',
  'Se nada no contexto cumprir todos os critérios com folga, responda só "@nenhuma" e "@fim". Responder @nenhuma é o resultado esperado na maioria dos trechos.',
  '',
  'Formato (linhas-marcadoras exatas, cada campo em uma linha):',
  '@curiosidade eco|termo',
  'gancho: (uma afirmação concreta e sóbria, até 90 caracteres, que já diz a curiosidade)',
  'ouvinte: (1 frase: o que os primeiros ouvintes sabiam ou entendiam) [[cite_id]]',
  'hoje: (1 frase: como se costuma ler hoje, ou o que se perde sem isso)',
  'muda: (1 frase: o que isso muda na leitura do trecho) [[cite_id]]',
  'evidencias: [[cite_id]] [[cite_id]]',
  'confianca: alta|media|baixa',
  '@fim',
].join('\n');

const CURIOSITY_REVIEW_INSTRUCTION = [
  'Você é um revisor rígido. Um leitor vai ver a curiosidade abaixo em destaque, como algo que vale a pena saber. Se ela não for de fato interessante, específica e bem fundamentada, ela quebra a confiança dele. Reprove na dúvida.',
  'Aprove só se TODAS forem verdade:',
  '1. É do tipo declarado (eco: alusão clara a algo que os primeiros ouvintes conheciam; termo: sentido original diferente do entendimento comum de hoje).',
  '2. Cada afirmação está sustentada pelas entradas citadas do contexto (leia-as); nada foi acrescentado de memória.',
  '3. A alusão ou o sentido não são apenas uma leitura possível ou disputada entre as fontes.',
  '4. Muda de fato a compreensão do trecho; não é um dado solto.',
  '5. Um leitor atento de hoje provavelmente não sabia disso.',
  '6. O gancho é sóbrio e fiel ao corpo, sem exagero.',
  'Responda só com:',
  '@veredito aprovada|reprovada',
  'motivo: (1 frase)',
  '@fim',
].join('\n');

export type CuriosityKind = 'eco' | 'termo';

export interface CuriosityCandidate {
  kind: CuriosityKind;
  /** Gancho: a curiosidade em uma afirmação sóbria (texto com os marcadores [[…]]). */
  hook: string;
  /** O que os primeiros ouvintes sabiam ou entendiam (com marcadores). */
  listener: string;
  /** Como se lê hoje, ou o que se perde sem isso (com marcadores). */
  today: string;
  /** O que isso muda na leitura do trecho (com marcadores). */
  change: string;
  /** cite_ids distintos das linhas evidencias, ouvinte e muda, nessa ordem. */
  evidence: string[];
  confidence: 'alta' | 'media' | 'baixa';
  /** Bloco da curiosidade como veio do modelo (do @curiosidade ao @fim, sem cercas de código). */
  raw: string;
}

const KINDS: readonly string[] = ['eco', 'termo'];
const CONFIDENCES: readonly string[] = ['alta', 'media', 'baixa'];
const FIELD_KEYS = ['gancho', 'ouvinte', 'hoje', 'muda', 'evidencias', 'confianca'] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

/** Linha de marcador: "@nome" com conteúdo opcional na mesma linha. */
const MARKER_RE = /^@(\p{L}+)\s*:?\s*(.*)$/u;
/** Linha de campo: "rótulo: valor" (rótulo com letras e espaços; negrito antes ou depois dos dois-pontos é tolerado). */
const FIELD_RE = /^(\p{L}[\p{L} ]*?)[*_\s]*:[*_\s]*(.*)$/u;
const CITE_RE = /\[\[([^[\]\n]+)\]\]/g;

function stripFences(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n').filter((l) => !/^\s*```/.test(l));
}

/** Linha sem enfeite de markdown (títulos, negrito, marcadores de lista) nas bordas. */
function cleanLine(raw: string): string {
  return raw.replace(/^[\s#>*_-]+/, '').replace(/[\s*_]+$/, '');
}

/** Nome normalizado do marcador da linha ("@Fim" -> "fim"); '' quando a linha não é marcador. */
function markerName(cleaned: string): string {
  const m = MARKER_RE.exec(cleaned);
  return m ? markerKey(m[1]!) : '';
}

/** cite_ids de um trecho: cada [[…]] pode trazer um ou mais ids (separados por espaço, vírgula ou ponto e vírgula). */
function citeIdsIn(s: string | undefined): string[] {
  if (!s) return [];
  return [...s.matchAll(CITE_RE)].flatMap((m) => m[1]!.split(/[\s,;]+/).filter(Boolean));
}

function uniq(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Lê a resposta do modelo à pergunta de curiosidade.
 * - 'none' para "@nenhuma" (sem @curiosidade na resposta);
 * - candidato quando há "@curiosidade eco|termo", os seis campos e "@fim";
 * - null para resposta incompleta (sem @fim) ou malformada.
 */
export function parseCuriosity(text: string): CuriosityCandidate | 'none' | null {
  const kept = stripFences(text);
  const lines = kept.map(cleanLine);
  const start = lines.findIndex((l) => markerName(l) === 'curiosidade');
  if (start < 0) return lines.some((l) => markerName(l) === 'nenhuma') ? 'none' : null;

  const kindWord = markerKey((MARKER_RE.exec(lines[start]!)?.[2] ?? '').trim().split(/\s+/)[0] ?? '').replace(/[^\p{L}]/gu, '');
  if (!KINDS.includes(kindWord)) return null;

  const values = new Map<FieldKey, string>();
  let current: FieldKey | null = null;
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    const name = markerName(line);
    if (name === 'fim') {
      end = i;
      break;
    }
    if (name || !line) continue;
    const f = FIELD_RE.exec(line);
    const key = f ? markerKey(f[1]!.trim()) : '';
    if (f && (FIELD_KEYS as readonly string[]).includes(key)) {
      current = key as FieldKey;
      if (!values.has(current)) values.set(current, f[2]!.trim());
    } else if (current) {
      values.set(current, [values.get(current), line].filter(Boolean).join(' '));
    }
  }
  if (end < 0) return null;
  if (!FIELD_KEYS.every((k) => values.has(k))) return null;

  const confidence = markerKey(values.get('confianca')!).replace(/[^\p{L}]/gu, '');
  if (!CONFIDENCES.includes(confidence)) return null;

  const listener = values.get('ouvinte')!;
  const change = values.get('muda')!;
  return {
    kind: kindWord as CuriosityKind,
    hook: values.get('gancho')!,
    listener,
    today: values.get('hoje')!,
    change,
    evidence: uniq([...citeIdsIn(values.get('evidencias')), ...citeIdsIn(listener), ...citeIdsIn(change)]),
    confidence: confidence as CuriosityCandidate['confidence'],
    raw: kept.slice(start, end + 1).join('\n').trim(),
  };
}

/** Palavras de exagero (pt e en), casadas como palavra inteira e sem diferenciar maiúsculas. */
const HYPE_WORDS = [
  'incrível', 'incrivel', 'chocante', 'segredo', 'ninguém', 'ninguem', 'surpreendente', 'impressionante',
  'incredible', 'shocking', 'secret', 'nobody', 'amazing',
];
const HYPE_RE = new RegExp(`(?<!\\p{L})(?:${HYPE_WORDS.join('|')})(?!\\p{L})`, 'iu');
const EXCLAMATION_RE = /[!?¡¿！？]/;
const ECO_TABLES: ReadonlySet<string> = new Set(['xref', 'dictionary_entry', 'commentary']);
const WORD_TABLES: ReadonlySet<string> = new Set(['token', 'lexicon_entry']);
const SENSE_TABLES: ReadonlySet<string> = new Set(['lexicon_entry', 'commentary', 'dictionary_entry']);

export type CuriosityGate = { ok: true } | { ok: false; reason: string };

/**
 * Portão em código (filtro 2). Reprova tudo que não for alta confiança, com campo vazio, gancho exagerado ou
 * sem as fontes mínimas do tipo. Só aprova o que está ancorado em entradas reais do contexto.
 */
export function acceptCuriosity(c: CuriosityCandidate, ctx: RichTextContext): CuriosityGate {
  const fail = (reason: string): CuriosityGate => ({ ok: false, reason });
  const table = (id: string): string => ctx.citeIndex.get(id)?.table ?? '';

  if (c.confidence !== 'alta') return fail(`confiança ${c.confidence}; só entra com confiança alta`);
  const emptyField = (['hook', 'listener', 'today', 'change'] as const).find((k) => !c[k].trim());
  if (emptyField) return fail(`campo vazio: ${emptyField}`);
  if (c.hook.length > 100) return fail(`gancho com ${c.hook.length} caracteres (máximo 100)`);
  if (EXCLAMATION_RE.test(c.hook)) return fail('gancho com exclamação ou interrogação');
  const hype = HYPE_RE.exec(c.hook);
  if (hype) return fail(`gancho com palavra de exagero: "${hype[0]}"`);

  const cited = uniq([...c.evidence, ...citeIdsIn(c.hook), ...citeIdsIn(c.today)]);
  const unknown = cited.find((id) => !ctx.citeIds.has(id));
  if (unknown) return fail(`citação que não existe no contexto: ${unknown}`);
  if (cited.length < 2) return fail(`${cited.length} citação(ões) distinta(s); precisa de pelo menos 2`);

  if (c.kind === 'eco') {
    if (!c.evidence.some((id) => ECO_TABLES.has(table(id)))) {
      return fail('eco sem referência cruzada, verbete de dicionário nem comentário');
    }
    return { ok: true };
  }

  const words = c.evidence.filter((id) => WORD_TABLES.has(table(id)));
  const senses = c.evidence.filter((id) => SENSE_TABLES.has(table(id)));
  if (words.length === 0) return fail('termo sem a palavra citada (token ou verbete de léxico)');
  if (senses.length === 0 || uniq([...words, ...senses]).length < 2) {
    return fail('termo sem fonte do sentido além da palavra (léxico, comentário ou dicionário)');
  }
  return { ok: true };
}

/** Mensagens da curiosidade (filtro 1): sistema, nota de foco (se houver), a instrução e o contexto. */
export function curiosityMessages(
  context: { text: string },
  opts: PromptOptions & { focus?: VerseRange } = {},
): ChatMessage[] {
  const focusNote = opts.focus
    ? `Seleção do leitor dentro desta unidade: ${formatReference(opts.focus)}. A curiosidade vem da unidade inteira; se houver uma que ilumine a seleção, prefira-a.\n\n`
    : '';
  return [
    { role: 'system', content: buildSystemPrompt(opts) },
    { role: 'user', content: `${focusNote}${CURIOSITY_INSTRUCTION}\n\n<contexto>\n${context.text}\n</contexto>` },
  ];
}

/** Mensagens do revisor rígido (filtro 3): contexto, candidato e instrução de reprovar na dúvida. */
export function curiosityReviewMessages(
  context: { text: string },
  candidate: CuriosityCandidate,
  opts: PromptOptions = {},
): ChatMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt(opts) },
    {
      role: 'user',
      content: `${CURIOSITY_REVIEW_INSTRUCTION}\n\n<contexto>\n${context.text}\n</contexto>\n\n<curiosidade>\n${candidate.raw}\n</curiosidade>`,
    },
  ];
}

/**
 * Lê a resposta do revisor. null se incompleta (sem @fim ou sem @veredito). Qualquer veredito diferente de
 * "aprovada" é reprovação.
 */
export function parseCuriosityReview(text: string): { approved: boolean; reason: string } | null {
  const lines = stripFences(text).map(cleanLine);
  if (!lines.some((l) => markerName(l) === 'fim')) return null;
  const idx = lines.findIndex((l) => markerName(l) === 'veredito');
  if (idx < 0) return null;

  const rest = (MARKER_RE.exec(lines[idx]!)?.[2] ?? '').trim();
  const verdictText = rest || (lines[idx + 1] ?? '');
  const verdict = markerKey(verdictText.trim().split(/\s+/)[0] ?? '').replace(/[^\p{L}]/gu, '');

  let reason = '';
  for (const line of lines) {
    const f = FIELD_RE.exec(line);
    if (f && markerKey(f[1]!.trim()) === 'motivo') {
      reason = f[2]!.trim();
      break;
    }
  }
  return { approved: verdict === 'aprovada', reason };
}
