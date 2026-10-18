// Linha do tempo: formatação das datas dos eventos, eras, densidade e termos de busca (as consultas ficam em
// Repo.timeline*; aqui só funções puras).
import type { TimelineEra, TimelineEraSummary } from './types';

/**
 * Data de um evento como texto para o leitor: "-4003" → "4003 a.C.", "0047" ou "0047-05-01" → "47 d.C.".
 * Mês e dia são descartados (a linha do tempo mostra só o ano). Formato não reconhecido, ou ano zero
 * (não existe na fonte), devolve null.
 */
export function formatEventDate(startDate: string | null | undefined): string | null {
  const m = /^(-?)(\d+)(?:-\d{1,2}-\d{1,2})?$/.exec(startDate?.trim() ?? '');
  if (!m) return null;
  const year = Number(m[2]);
  if (year === 0) return null;
  return m[1] ? `${year} a.C.` : `${year} d.C.`;
}

/**
 * Eras da Bíblia para o resumo e o filtro, em sortKey (anos negativos = a.C.). Intervalos [from, to). Os cortes
 * são uma proposta do projeto, não da fonte. A lacuna intertestamentária não tem eventos na fonte (gap).
 */
export const TIMELINE_ERAS: readonly TimelineEra[] = [
  { id: 'primordios', name: 'Da criação a Abraão', from: -4100, to: -2000 },
  { id: 'patriarcas', name: 'Patriarcas', from: -2000, to: -1500 },
  { id: 'exodo', name: 'Êxodo e conquista', from: -1500, to: -1400 },
  { id: 'juizes', name: 'Juízes', from: -1400, to: -1050 },
  { id: 'reino-unido', name: 'Reino unido', from: -1050, to: -950 },
  { id: 'reino-dividido', name: 'Reino dividido', from: -950, to: -586 },
  { id: 'exilio', name: 'Exílio e retorno', from: -586, to: -440 },
  { id: 'intertestamentario', name: 'Período intertestamentário', from: -440, to: -5, gap: true },
  { id: 'vida-de-jesus', name: 'Vida de Jesus', from: -5, to: 30 },
  { id: 'igreja', name: 'Igreja primitiva', from: 30, to: 100 },
];

/** Faixas do histograma de densidade de cada era. */
export const TIMELINE_DENSITY_BINS = 10;

/**
 * Histograma de contagens: `bins` faixas iguais em [from, to). Posições fora do intervalo não entram.
 * Serve ao resumo das eras e à faixa de densidade do paralelo (com o intervalo visível).
 */
export function densityBins(sortKeys: readonly number[], from: number, to: number, bins: number): number[] {
  const out = new Array<number>(Math.max(0, bins)).fill(0);
  const span = to - from;
  if (out.length === 0 || !(span > 0)) return out;
  for (const k of sortKeys) {
    if (k < from || k >= to) continue;
    const b = Math.min(out.length - 1, Math.floor(((k - from) / span) * out.length));
    out[b]! += 1;
  }
  return out;
}

/** Resumo de cada era: contagem de eventos e histograma de densidade. Puro (recebe as posições cronológicas). */
export function eraSummaries(sortKeys: readonly number[], eras: readonly TimelineEra[] = TIMELINE_ERAS): TimelineEraSummary[] {
  return eras.map((era) => {
    const density = densityBins(sortKeys, era.from, era.to, TIMELINE_DENSITY_BINS);
    return { ...era, count: density.reduce((a, b) => a + b, 0), density };
  });
}

/**
 * Termos em português da busca e os termos em inglês das fontes (títulos e nomes). Chave já normalizada (sem
 * acento, minúscula). Casa quando a chave começa com a busca, ou a busca (≥ 3 letras) começa com a chave.
 */
const PT_TERMS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['prisao', ['impris']],
  ['preso', ['impris']],
  ['ceia', ['supper']],
  ['cruz', ['cross', 'crucifix']],
  ['crucificacao', ['crucifix']],
  ['viagem', ['journey', 'voyage']],
  ['ressurreicao', ['resurrection']],
  ['reino', ['reign', 'kingdom']],
  ['morte', ['death']],
  ['templo', ['temple']],
  ['conversao', ['convert']],
  ['naufragio', ['shipwreck']],
  ['roma', ['rome']],
  ['diluvio', ['flood']],
  ['paulo', ['paul']],
  ['pedro', ['peter']],
  ['estevao', ['stephen']],
  ['barnabe', ['barnabas']],
  ['timoteo', ['timothy', 'timotheus']],
  ['davi', ['david']],
  ['salomao', ['solomon']],
  ['moises', ['moses']],
  ['abraao', ['abraham']],
  ['egito', ['egypt']],
  ['cafarnaum', ['capernaum']],
  ['juda', ['judah']],
  ['jerusalem', ['jerusalem']],
  ['samaria', ['samaria']],
];

/** Normaliza texto de busca: minúsculas, sem acento, espaços aparados e espaços internos colapsados ("morte  de saul"). */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Termos de busca: o texto normalizado e os equivalentes em inglês dos termos em português que casam com ele. */
export function searchTerms(query: string): string[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  const terms = new Set<string>([q]);
  for (const [pt, en] of PT_TERMS) {
    if (pt.startsWith(q) || (q.length >= 3 && q.startsWith(pt))) for (const t of en) terms.add(t);
  }
  return [...terms];
}

/**
 * Casa a busca com um nome em português (tabela entity_name): sem acento, sem caixa, por trecho, como o nome em
 * inglês. "arao" acha "Arão"; "joquebede" acha "Joquebede". Busca vazia não casa; nome ausente não casa.
 */
export function matchesSearchName(name: string | null | undefined, query: string): boolean {
  const q = normalizeSearch(query);
  return q !== '' && normalizeSearch(name ?? '').includes(q);
}

/** Distância (anos) a partir da qual uma ponta isolada sai da extensão da linha (ver timelineCore). */
export const TIMELINE_FAR_YEARS = 50;

/** Núcleo de uma linha: a extensão sem as pontas isoladas, e as posições descartadas (`far`, em ordem). */
export interface TimelineCore {
  lo: number;
  hi: number;
  far: number[];
}

/**
 * Extensão de uma linha sem os eventos isolados nas pontas (ex.: Jesus "participa" da criação, em 4003 a.C.; Moisés
 * na transfiguração). Uma ponta sai quando o intervalo até o vizinho passa de 50 anos e de metade do que resta da
 * linha. Para com dois eventos. Linha vazia devolve lo = hi = 0 e nenhuma posição descartada.
 */
export function timelineCore(sortKeys: readonly number[], farYears: number = TIMELINE_FAR_YEARS): TimelineCore {
  const ys = [...sortKeys].sort((a, b) => a - b);
  if (ys.length === 0) return { lo: 0, hi: 0, far: [] };
  let i = 0;
  let j = ys.length - 1;
  const far: number[] = [];
  while (j - i >= 2 && ys[i + 1]! - ys[i]! > farYears && ys[i + 1]! - ys[i]! > 0.5 * (ys[j]! - ys[i + 1]!)) far.push(ys[i++]!);
  while (j - i >= 2 && ys[j]! - ys[j - 1]! > farYears && ys[j]! - ys[j - 1]! > 0.5 * (ys[j - 1]! - ys[i]!)) far.push(ys[j--]!);
  return { lo: ys[i]!, hi: ys[j]!, far: far.sort((a, b) => a - b) };
}
