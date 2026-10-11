// Lugares para os mapas: agrupa a mesma localidade vinda de fontes diferentes e lê a confiança
// da identificação (OpenBible.info, association_score de 0 a 1000). Função pura, sem banco.
import type { PlaceVerseHit } from './repo';

/** Faixas de confiança da identificação (legenda dos mapas). `none` = a fonte não avalia. */
export type ConfidenceBand = 'high' | 'mid' | 'low' | 'none';

/** Identificação moderna proposta pelo OpenBible (candidatas, com pontuação 0 a 1). */
export interface PlaceCandidate {
  name: string;
  /** 0 a 1; null quando a fonte não informa. */
  score: number | null;
}

/** Um lugar no mapa: uma localidade, possivelmente citada por várias fontes. */
export interface PlaceSite {
  /** Chave estável: nome normalizado + coordenadas arredondadas. */
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Fontes que compõem o lugar, com a principal primeiro. */
  citeIds: string[];
  sourceIds: string[];
  /** Versículos do lugar dentro do intervalo consultado (ordenados, sem repetição). */
  vids: number[];
  /** Confiança da identificação (OpenBible), 0 a 1; null se nenhuma fonte avalia. */
  confidence: number | null;
  band: ConfidenceBand;
  description: string | null;
  /** Identificações modernas candidatas (OpenBible), da melhor para a pior. */
  candidates: PlaceCandidate[];
  /** Outros lugares com o mesmo nome (localidades diferentes), no mesmo conjunto. */
  homonyms: Array<{ id: string; name: string; lat: number; lon: number }>;
}

const SOURCE_RANK: Record<string, number> = { 'openbible-geo': 0, theographic: 1, 'stepbible-tipnr': 2 };
const MERGE_KM = 150;

/** Nome para comparação: sem sublinhado, sem número de desambiguação ("Antioch 1"), sem caixa. */
export function normPlaceName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/’/g, "'")
    .replace(/\s+\d+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function confidenceBand(confidence: number | null): ConfidenceBand {
  if (confidence == null) return 'none';
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'mid';
  return 'low';
}

interface OpenBibleData {
  score: number | null;
  candidates: PlaceCandidate[];
}

/** Lê o JSON de `entity.data` da fonte OpenBible (campos best_modern e modern_candidates). */
export function openBibleOf(data: string | null): OpenBibleData | null {
  if (!data) return null;
  try {
    const d = JSON.parse(data) as {
      best_modern?: { association_score?: number };
      modern_candidates?: Array<{ name?: string; score?: number }>;
    };
    const raw = d.best_modern?.association_score;
    const score = typeof raw === 'number' ? Math.max(0, Math.min(1, raw / 1000)) : null;
    const candidates = (d.modern_candidates ?? [])
      .filter((c) => typeof c.name === 'string')
      .map((c) => ({ name: c.name as string, score: typeof c.score === 'number' ? Math.min(1, c.score / 1000) : null }));
    return { score, candidates };
  } catch {
    return null;
  }
}

function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface Building {
  site: PlaceSite;
  vids: Set<number>;
  sources: Set<string>;
  citeIds: string[];
  rank: number;
}

/**
 * Agrupa linhas (lugar, versículo) em lugares. Duas entidades são o mesmo lugar quando o nome normalizado
 * coincide e as coordenadas ficam a até 150 km. A ordem de precedência das coordenadas é OpenBible, Theographic, TIPNR.
 */
export function groupPlaces(rows: PlaceVerseHit[]): PlaceSite[] {
  const byEntity = new Map<string, { entity: PlaceVerseHit; vids: Set<number> }>();
  for (const r of rows) {
    const cur = byEntity.get(r.cite_id) ?? { entity: r, vids: new Set<number>() };
    cur.vids.add(r.vid);
    byEntity.set(r.cite_id, cur);
  }
  const entities = [...byEntity.values()].sort(
    (a, b) => (SOURCE_RANK[a.entity.source_id] ?? 9) - (SOURCE_RANK[b.entity.source_id] ?? 9) || a.entity.cite_id.localeCompare(b.entity.cite_id),
  );

  const buildings: Building[] = [];
  for (const { entity, vids } of entities) {
    const key = normPlaceName(entity.name);
    const ob = entity.source_id === 'openbible-geo' ? openBibleOf(entity.data) : null;
    const same = buildings.find((b) => normPlaceName(b.site.name) === key && kmBetween(b.site, entity) <= MERGE_KM);
    if (same) {
      same.citeIds.push(entity.cite_id);
      same.sources.add(entity.source_id);
      for (const v of vids) same.vids.add(v);
      if (ob && same.site.confidence == null && ob.score != null) {
        same.site.confidence = ob.score;
      }
      if (ob && same.site.candidates.length === 0) same.site.candidates = ob.candidates;
      continue;
    }
    const conf = ob?.score ?? null;
    buildings.push({
      site: {
        id: `${key}@${entity.lat.toFixed(2)},${entity.lon.toFixed(2)}`,
        name: entity.name.replace(/_/g, ' ').replace(/\s+\d+$/, ''),
        lat: entity.lat,
        lon: entity.lon,
        citeIds: [],
        sourceIds: [],
        vids: [],
        confidence: conf,
        band: confidenceBand(conf),
        description: entity.description,
        candidates: ob?.candidates ?? [],
        homonyms: [],
      },
      vids,
      sources: new Set([entity.source_id]),
      citeIds: [entity.cite_id],
      rank: SOURCE_RANK[entity.source_id] ?? 9,
    });
  }

  for (const b of buildings) {
    b.site.citeIds = b.citeIds;
    b.site.sourceIds = [...b.sources];
    b.site.vids = [...b.vids].sort((x, y) => x - y);
    b.site.band = confidenceBand(b.site.confidence);
  }
  const sites = buildings.map((b) => b.site);
  // Homônimos: mesmo nome normalizado, lugar distinto (fora de 150 km).
  for (const s of sites) {
    s.homonyms = sites
      .filter((o) => o !== s && normPlaceName(o.name) === normPlaceName(s.name))
      .map((o) => ({ id: o.id, name: o.name, lat: o.lat, lon: o.lon }));
  }
  return sites.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** Lugares em que o versículo aparece, para os chips "Passagens" de um lugar. */
export function sitesAtVid(sites: PlaceSite[], vid: number): PlaceSite[] {
  return sites.filter((s) => s.vids.includes(vid));
}

/** Nota curta de confiança para a legenda e o cartão (ex.: "alta · 0,98"). */
export function confidenceLabel(site: Pick<PlaceSite, 'confidence' | 'band'>, words: Record<ConfidenceBand, string>): string {
  if (site.confidence == null) return words.none;
  return `${words[site.band]} · ${site.confidence.toFixed(2).replace('.', ',')}`;
}
