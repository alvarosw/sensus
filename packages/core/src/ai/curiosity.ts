// Curiosidade do trecho: no máximo UMA nota (tipo eco ou termo) e só quando o contexto a sustenta.
// Três filtros em série: (1) o prompt pode responder "@nenhuma"; (2) o portão em código (acceptCuriosity);
// (3) uma segunda chamada ao modelo, como revisor rígido que por padrão reprova (curiosityReviewMessages).
import type { ChatMessage, VerseRange } from '../types';
import { formatReference } from '../refs';
import { buildSystemPrompt, type PromptOptions } from './prompts';
import { markerKey } from './structured';
import type { RichTextContext } from './structured-types';

/** Versão do prompt da curiosidade: muda quando o texto muda, para invalidar o cache. */
export const CURIOSITY_PROMPT_VERSION = 'curiosidade-v3';
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
  'Prefira eco. Use termo só quando a diferença de sentido muda o que o trecho ensina ou narra, e quando o sentido de "hoje" é o das traduções e leituras comuns.',
  '',
  'Critérios (todos obrigatórios):',
  '- A alusão ou o sentido estão atestados por pelo menos duas entradas do contexto (cite os cite_id); nada de memória própria.',
  '- É específica deste trecho; não serve para qualquer passagem.',
  '- Muda a compreensão; não é só um dado (contagem de ocorrências, hápax, autoria, data, existência de uma referência cruzada, etimologia sem efeito no sentido).',
  '- Não é leitura disputada apresentada como fato; não é inferência; não é aplicação.',
  '- Não exagera: sem "incrível", "chocante", "segredo", "ninguém sabe", pontos de exclamação ou suspense.',
  '- Trata do trecho selecionado; não use versículos fora da unidade do contexto.',
  '- Não toma partido em questão que divide tradições ou estudiosos (ex.: se Maria teve outros filhos, "almah" em Is 7:14, o sentido de harpagmos); se as fontes do contexto discordam, não é curiosidade.',
  '- O gancho diz a curiosidade em si (o que muda), não resume o versículo.',
  'Exemplos do que NÃO serve: uma genealogia começa por Sete e não cita Caim; "cabeça" num censo quer dizer cada pessoa contada; "casa do Senhor" era o tabernáculo; uma palavra aparece poucas vezes; o texto tem uma variante de pontuação; um detalhe técnico que não muda o sentido do trecho (contagem de cidades, se um nome de lugar é composto, gênero gramatical de um título, a forma física de um objeto ou remédio).',
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
  'Você é o editor rígido da seção "Curiosidade" de um app de estudo bíblico. Ela aparece em destaque; se não for de fato surpreendente e sólida, o leitor perde a confiança. Na dúvida, dê nota baixa.',
  'Avalie a curiosidade abaixo contra o contexto (leia as entradas citadas pelos cite_id).',
  '',
  'interesse (1 a 5): um leitor atento de hoje se surpreenderia e passaria a ler o trecho de outro jeito?',
  '  5 = muda a leitura do trecho e quase ninguém sabe. Exemplos: em Jo 8:58, "antes que Abraão existisse, Eu sou" ecoa o nome de Deus em Êx 3:14, e por isso pegam pedras; em Gl 3:13, "maldito todo aquele pendurado no madeiro" cita Dt 21:23, a maldição que a cruz carregava aos olhos de um judeu.',
  '  3 = correta e útil, mas o leitor já intuía ou muda pouco a leitura.',
  '  1 = dado solto, óbvio ou técnico. Exemplos: uma genealogia começa por Sete e não cita Caim; "cabeça" num censo quer dizer cada pessoa contada; "casa do Senhor" era o tabernáculo; "xenos" ali quer dizer anfitrião.',
  'fundamento (1 a 5): cada afirmação está escrita nas entradas citadas do contexto, sem nada de memória?',
  '  5 = tudo está nas entradas citadas. 3 = a ideia está lá, mas o texto vai além em algum ponto. 1 = a afirmação central não está nas entradas.',
  'disputa (sim/nao): toma partido numa questão em que tradições ou estudiosos discordam, ou apresenta uma leitura possível como a certa?',
  'alcance (sim/nao): trata do trecho da unidade do contexto (e não de versículos fora dela)?',
  'tipo (sim/nao): é mesmo do tipo declarado (eco: alusão clara a algo que os primeiros ouvintes conheciam; termo: sentido original diferente do entendimento comum de hoje)?',
  'peso (sim/nao): importa para o sentido do trecho — o que ele ensina ou narra —, e não só para um detalhe técnico (contagem, nome de lugar, gramática, forma de um objeto, título)?',
  '',
  'Responda só com estas linhas:',
  'interesse: N',
  'fundamento: N',
  'disputa: sim|nao',
  'alcance: sim|nao',
  'tipo: sim|nao',
  'peso: sim|nao',
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
 * - candidato quando há "@curiosidade eco|termo" e os seis campos; o "@fim" é desejável, mas não obrigatório;
 * - null para campo faltando, tipo ou confiança inválidos.
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
  // Sem @fim, a curiosidade vai até a última linha: o que faltar nos campos é que decide.
  let end = lines.length - 1;
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
  if (c.hook.length > 120) return fail(`gancho com ${c.hook.length} caracteres (máximo 120)`);
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

/** Resultado do revisor por notas: as cinco respostas lidas e o veredito calculado por reviewApproves. */
export interface CuriosityReview {
  /** 1 a 5: quanto um leitor de hoje se surpreenderia e leria o trecho de outro jeito. */
  interest: number;
  /** 1 a 5: quanto cada afirmação está escrita nas entradas citadas. */
  grounding: number;
  /** true quando toma partido em questão disputada, ou apresenta leitura possível como a certa. */
  disputed: boolean;
  /** true quando trata do trecho da unidade (e não de versículos fora dela). */
  inScope: boolean;
  /** true quando é mesmo do tipo declarado (eco ou termo). */
  kindOk: boolean;
  /** true quando importa para o sentido do trecho (o que ensina ou narra), e não só um detalhe técnico. */
  weighty: boolean;
  reason: string;
  approved: boolean;
}

/**
 * Regra de aprovação do revisor (pura). Cada condição reprova sozinha: interesse e fundamento em 4 ou mais,
 * sem disputa, dentro do alcance, do tipo declarado e com peso no sentido do trecho.
 */
export function reviewApproves(
  r: Pick<CuriosityReview, 'interest' | 'grounding' | 'disputed' | 'inScope' | 'kindOk' | 'weighty'>,
): boolean {
  return r.interest >= 4 && r.grounding >= 4 && !r.disputed && r.inScope && r.kindOk && r.weighty;
}

const REVIEW_KEYS = ['interesse', 'fundamento', 'disputa', 'alcance', 'tipo', 'peso', 'motivo'] as const;

/** Nota de 1 a 5 no começo do valor ("5", "5 (…)"); fora disso é null. */
function scoreOf(v: string | undefined): number | null {
  const m = /^(\d+)\b/.exec((v ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 5 ? n : null;
}

/** "sim" ou "nao" (com ou sem acento) como primeira palavra do valor; outra coisa é null. */
function yesNoOf(v: string | undefined): boolean | null {
  const word = markerKey((v ?? '').trim().split(/\s+/)[0] ?? '').replace(/[^\p{L}]/gu, '');
  if (word === 'sim') return true;
  if (word === 'nao') return false;
  return null;
}

/**
 * Lê a resposta do revisor por notas. null se faltar campo ou algum valor for inválido (nota fora de 1..5,
 * disputa/alcance/tipo que não sejam sim ou não). O "@fim" é desejável, mas não obrigatório.
 */
export function parseCuriosityReview(text: string): CuriosityReview | null {
  const lines = stripFences(text).map(cleanLine);
  const values = new Map<string, string>();
  let current: string | null = null;
  for (const line of lines) {
    const name = markerName(line);
    if (name === 'fim') break;
    if (name || !line) continue;
    const f = FIELD_RE.exec(line);
    const key = f ? markerKey(f[1]!.trim()) : '';
    if (f && (REVIEW_KEYS as readonly string[]).includes(key)) {
      current = key;
      if (!values.has(key)) values.set(key, f[2]!.trim());
    } else if (current) {
      values.set(current, [values.get(current), line].filter(Boolean).join(' '));
    }
  }
  if (!REVIEW_KEYS.every((k) => values.has(k))) return null;

  const interest = scoreOf(values.get('interesse'));
  const grounding = scoreOf(values.get('fundamento'));
  const disputed = yesNoOf(values.get('disputa'));
  const inScope = yesNoOf(values.get('alcance'));
  const kindOk = yesNoOf(values.get('tipo'));
  const weighty = yesNoOf(values.get('peso'));
  if (
    interest === null || grounding === null || disputed === null || inScope === null || kindOk === null ||
    weighty === null
  ) {
    return null;
  }
  const base = { interest, grounding, disputed, inScope, kindOk, weighty, reason: values.get('motivo')! };
  return { ...base, approved: reviewApproves(base) };
}
