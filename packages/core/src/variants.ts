// Variantes textuais por lacunas: alinha as leituras de TR, BYZ e NA de cada versículo.
import type { Token } from './types';
import { formatVerse } from './refs';
import { BASE_EDITIONS, hasEdition } from './panel';

/** Uma leitura (ou um grupo de edições com a mesma leitura) em um sítio de variação. */
export interface VariantReading {
  /** Edições que trazem esta leitura, na ordem TR, BYZ, NA (ex.: ['TR', 'BYZ']). */
  editions: string[];
  /** Palavras desta leitura, na ordem textual (vazio = omissão). */
  tokens: Token[];
}

export interface VariantSite {
  vid: number;
  /** Referência em pt-BR do versículo, ex.: "Filipenses 2:5". */
  ref: string;
  /** Palavras da leitura TR neste ponto (vazio = omitida no TR). */
  trReading: Token[];
  /** Palavras da leitura NA neste ponto (vazio = omitida no NA). */
  naReading: Token[];
  /**
   * Leituras do sítio, com as edições de leitura idêntica agrupadas (ex.: TR/BYZ e NA).
   * Sempre tem pelo menos duas leituras distintas.
   */
  readings: VariantReading[];
}

/** Palavra presente em todas as edições comparadas: âncora que delimita os sítios. */
function isAnchor(t: Token): boolean {
  return BASE_EDITIONS.every((e) => hasEdition(t, e));
}

/**
 * Monta o sítio de uma lacuna (palavras entre duas âncoras). Cada edição lê as palavras da lacuna que
 * a contêm, em ordem; edições com a mesma sequência de tokens ficam agrupadas.
 * Devolve null se todas as leituras coincidem (inclusive vazias): não há variação a mostrar.
 */
function siteOf(vid: number, gap: readonly Token[]): VariantSite | null {
  const perEdition = BASE_EDITIONS.map((edition) => ({
    edition,
    tokens: gap.filter((t) => hasEdition(t, edition)),
  }));
  const groups: Array<{ signature: string; reading: VariantReading }> = [];
  for (const { edition, tokens } of perEdition) {
    const signature = tokens.map((t) => t.cite_id).join(',');
    const group = groups.find((g) => g.signature === signature);
    if (group) group.reading.editions.push(edition);
    else groups.push({ signature, reading: { editions: [edition], tokens } });
  }
  if (groups.length < 2) return null;
  return {
    vid,
    ref: formatVerse(vid),
    trReading: perEdition[0]!.tokens,
    naReading: perEdition[BASE_EDITIONS.length - 1]!.tokens,
    readings: groups.map((g) => g.reading),
  };
}

/**
 * Sítios de variação do NT grego (corpus gnt). Percorre as palavras de cada versículo em ordem de pos:
 * palavras presentes em TR, BYZ e NA são âncoras; cada trecho contínuo de palavras não-âncora é um sítio.
 * Trechos antes da primeira âncora ou depois da última também são sítios (a borda do versículo faz
 * de âncora), para que uma omissão no fim do versículo não desapareça. Versículos sem diferença não
 * geram sítios.
 */
export function variantSites(tokens: readonly Token[]): VariantSite[] {
  const sorted = tokens.filter((t) => t.corpus === 'gnt').sort((x, y) => x.vid - y.vid || x.pos - y.pos);
  const byVid = new Map<number, Token[]>();
  for (const t of sorted) {
    const list = byVid.get(t.vid) ?? [];
    list.push(t);
    byVid.set(t.vid, list);
  }

  const sites: VariantSite[] = [];
  for (const [vid, group] of byVid) {
    let gap: Token[] = [];
    const flush = (): void => {
      const site = gap.length > 0 ? siteOf(vid, gap) : null;
      if (site) sites.push(site);
      gap = [];
    };
    for (const t of group) {
      if (isAnchor(t)) flush();
      else gap.push(t);
    }
    flush();
  }
  return sites;
}
