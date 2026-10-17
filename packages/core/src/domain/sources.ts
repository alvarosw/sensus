// Registro único de fontes e tradições: nomes curtos e longos, comentaristas, papel de cada fonte e rótulos pt-BR.
// Dono de todo rótulo de fonte (citações, leitor, lentes, painel da IA) e da regra de nome do comentarista.
// Fonte nova: uma entrada em SOURCES (e, se a tradição for nova, em TRADITIONS) + linha em DATA_LICENSES.md.
// O teste packages/core/test/domain-sources.test.ts falha se faltar rótulo.
import type { Commentary, Source } from '../types';

export type SourceRole =
  | 'text' // tradução corrida (BLivre, KJV)
  | 'interlinear' // texto original alinhado ao leitor (TR, WLC)
  | 'tokens' // análise morfológica palavra a palavra (TAGNT, TAHOT)
  | 'lexicon'
  | 'dictionary'
  | 'topical'
  | 'xref'
  | 'entity'
  | 'commentary';

export type SourceTestament = 'OT' | 'NT';

export interface SourceInfo {
  /** Nome curto das citações ("Calvino Fp 1:30", "TBESG", "Bíblia Livre Fp 1:30"). */
  short: string;
  /** Nome longo (cabeçalho do leitor). Demais fontes usam `short`. */
  long?: string;
  /** Sigla da barra superior e dos seletores de texto ("BLivre"). */
  abbr?: string;
  /** Nome do comentarista (obrigatório nas fontes `commentary`). */
  commentator?: string;
  role: SourceRole;
  /** Língua do conteúdo (BCP-47). */
  lang?: string;
  /** Testamentos que a fonte cobre (textos e tokens). */
  testaments?: readonly SourceTestament[];
}

const OT_NT: readonly SourceTestament[] = ['OT', 'NT'];

export const SOURCES: Readonly<Record<string, SourceInfo>> = {
  // ---- textos
  blivre: { short: 'Bíblia Livre', long: 'Bíblia Livre', abbr: 'BLivre', role: 'text', lang: 'pt', testaments: OT_NT },
  kjv: { short: 'KJV', long: 'King James Version', abbr: 'KJV', role: 'text', lang: 'en', testaments: OT_NT },
  'grc-tr': { short: 'TR', role: 'interlinear', lang: 'grc', testaments: ['NT'] },
  'hbo-wlc': { short: 'WLC', role: 'interlinear', lang: 'hbo', testaments: ['OT'] },
  // ---- tokens (análise palavra a palavra)
  tagnt: { short: 'TAGNT', role: 'tokens', lang: 'grc', testaments: ['NT'] },
  tahot: { short: 'TAHOT', role: 'tokens', lang: 'hbo', testaments: ['OT'] },
  // ---- léxicos
  'stepbible-tbesg': { short: 'TBESG', role: 'lexicon', lang: 'en' },
  'stepbible-tbesh': { short: 'TBESH', role: 'lexicon', lang: 'en' },
  'stepbible-tflsj': { short: 'LSJ', role: 'lexicon', lang: 'en' },
  // ---- dicionários e tópicos
  'sword-easton': { short: 'Easton', role: 'dictionary', lang: 'en' },
  'sword-hitchcock': { short: 'Hitchcock', role: 'dictionary', lang: 'en' },
  'sword-isbe': { short: 'ISBE', role: 'dictionary', lang: 'en' },
  'sword-smith': { short: 'Smith', role: 'dictionary', lang: 'en' },
  'sword-nave': { short: 'Nave', role: 'topical', lang: 'en' },
  'sword-torrey': { short: 'Torrey', role: 'topical', lang: 'en' },
  // ---- referências cruzadas e entidades
  'openbible-xref': { short: 'OpenBible', role: 'xref', lang: 'en' },
  'sword-tsk': { short: 'TSK', role: 'xref', lang: 'en' },
  'openbible-geo': { short: 'OpenBible', role: 'entity', lang: 'en' },
  'stepbible-tipnr': { short: 'TIPNR', role: 'entity', lang: 'en' },
  theographic: { short: 'Theographic', role: 'entity', lang: 'en' },
  // ---- comentários
  patristic: { short: 'Patrística', commentator: 'Padres da Igreja', role: 'commentary', lang: 'en' },
  gill: { short: 'Gill', commentator: 'Gill', role: 'commentary', lang: 'en' },
  'sword-barnes': { short: 'Barnes', commentator: 'Barnes', role: 'commentary', lang: 'en' },
  'sword-calvincommentaries': { short: 'Calvino', commentator: 'Calvino', role: 'commentary', lang: 'en' },
  'sword-clarke': { short: 'Clarke', commentator: 'Clarke', role: 'commentary', lang: 'en' },
  'sword-jfb': { short: 'Jamieson-Fausset-Brown', commentator: 'Jamieson-Fausset-Brown', role: 'commentary', lang: 'en' },
  'sword-kd': { short: 'Keil e Delitzsch', commentator: 'Keil e Delitzsch', role: 'commentary', lang: 'en' },
  'sword-mhc': { short: 'Matthew Henry', commentator: 'Matthew Henry', role: 'commentary', lang: 'en' },
  'sword-rwp': { short: 'Robertson', commentator: 'Robertson', role: 'commentary', lang: 'en' },
  'sword-scofield': { short: 'Scofield', commentator: 'Scofield', role: 'commentary', lang: 'en' },
  'sword-wesley': { short: 'Wesley', commentator: 'Wesley', role: 'commentary', lang: 'en' },
  // Lote 1 (domínio público pelo .conf; ver DATA_LICENSES.md)
  'sword-abbott': { short: 'Abbott', commentator: 'Abbott', role: 'commentary', lang: 'en' },
  'sword-burkitt': { short: 'Burkitt', commentator: 'Burkitt', role: 'commentary', lang: 'en' },
  'sword-catena': { short: 'Catena Aurea', commentator: 'Tomás de Aquino', role: 'commentary', lang: 'en' },
  'sword-lightfoot': { short: 'Lightfoot', commentator: 'Lightfoot', role: 'commentary', lang: 'en' },
  'sword-luther': { short: 'Lutero', commentator: 'Lutero', role: 'commentary', lang: 'en' },
  'sword-pnt': { short: 'B. W. Johnson', commentator: 'B. W. Johnson', role: 'commentary', lang: 'en' },
  'sword-tfg': { short: 'McGarvey', commentator: 'McGarvey e Pendleton', role: 'commentary', lang: 'en' },
  // Adventistas (Ellen G. White, domínio público; só parágrafos com referência explícita). O comentarista leva a
  // obra: duas obras dela no mesmo versículo precisam de rótulos distintos.
  'egw-great-controversy': { short: 'Grande Conflito', commentator: 'Ellen G. White · Grande Conflito', role: 'commentary', lang: 'en' },
  'egw-patriarchs': { short: 'Patriarcas e Profetas', commentator: 'Ellen G. White · Patriarcas e Profetas', role: 'commentary', lang: 'en' },
  'egw-prophets': { short: 'Profetas e Reis', commentator: 'Ellen G. White · Profetas e Reis', role: 'commentary', lang: 'en' },
  'egw-acts': { short: 'Atos dos Apóstolos', commentator: 'Ellen G. White · Atos dos Apóstolos', role: 'commentary', lang: 'en' },
  'egw-object-lessons': { short: 'Parábolas de Jesus', commentator: 'Ellen G. White · Parábolas de Jesus', role: 'commentary', lang: 'en' },
  'egw-steps': { short: 'Caminho a Cristo', commentator: 'Ellen G. White · Caminho a Cristo', role: 'commentary', lang: 'en' },
};

/** Rótulos pt-BR das tradições (o valor vem do pipeline, campo `source.tradition`). */
export const TRADITIONS: Readonly<Record<string, { pt: string }>> = {
  reformed: { pt: 'reformada' },
  'reformed-baptist': { pt: 'batista reformada' },
  presbyterian: { pt: 'presbiteriana' },
  methodist: { pt: 'metodista' },
  baptist: { pt: 'batista' },
  dispensational: { pt: 'dispensacionalista' },
  patristic: { pt: 'patrística' },
  adventist: { pt: 'adventista' },
  catholic: { pt: 'católica' },
  lutheran: { pt: 'luterana' },
  anglican: { pt: 'anglicana' },
  congregational: { pt: 'congregacional' },
  restoration: { pt: 'restauracionista' },
};

/** Pais da Igreja: nome no primeiro trecho do comentário ("John Chrysostom — Homily...") -> nome em português. */
const PATRISTIC_FATHERS: Readonly<Record<string, string>> = {
  'john chrysostom': 'Crisóstomo',
  chrysostom: 'Crisóstomo',
  'augustine of hippo': 'Agostinho',
  augustine: 'Agostinho',
  jerome: 'Jerônimo',
  'ambrose of milan': 'Ambrósio de Milão',
  ambrose: 'Ambrósio',
  origen: 'Orígenes',
  irenaeus: 'Irineu',
  tertullian: 'Tertuliano',
  'clement of alexandria': 'Clemente de Alexandria',
  'clement of rome': 'Clemente de Roma',
  cyprian: 'Cipriano',
  'hippolytus of rome': 'Hipólito de Roma',
  'hilary of poitiers': 'Hilário de Poitiers',
  'methodius of olympus': 'Metódio de Olimpo',
  'gregory of nyssa': 'Gregório de Nissa',
  'gregory of nazianzus': 'Gregório de Nazianzo',
  'ignatius of antioch': 'Inácio de Antioquia',
  'lucius caecilius firmianus lactantius': 'Lactâncio',
  'polycrates of ephesus': 'Policrates de Éfeso',
  theodoret: 'Teodoreto',
  cyril: 'Cirilo',
  athanasius: 'Atanásio',
};

const own = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

/** Título curto para a linha de citação: "TBESG - Translators Brief..." vira "TBESG". */
export function shortTitle(title: string): string {
  if (title.length <= 40) return title;
  const head = title.split(/ - | \(/)[0]?.trim();
  return head && head.length >= 2 ? head : title.slice(0, 40);
}

/** Nome curto da fonte. Fonte fora do registro: título curto do banco, ou o próprio id sem título. */
export function sourceShort(id: string, fallbackTitle?: string): string {
  const info = own(SOURCES, id);
  if (info) return info.short;
  return fallbackTitle ? shortTitle(fallbackTitle) : id;
}

/** Sigla da barra superior e dos seletores ("BLivre", "KJV"); sem sigla, o nome curto. */
export function sourceAbbr(id: string): string {
  return own(SOURCES, id)?.abbr ?? sourceShort(id);
}

/** Nome longo para cabeçalhos ("King James Version"); sem nome longo, o nome curto. */
export function sourceLong(id: string): string {
  return own(SOURCES, id)?.long ?? sourceShort(id);
}

/**
 * Nome do comentarista de um comentário. Pais da Igreja: o nome vem do primeiro trecho do texto. Demais: o
 * comentarista do registro; fonte fora do registro, o autor (ou título) do banco, sem o que vem entre parênteses.
 */
export function commentatorOf(source: Source | undefined, commentary: Commentary): string {
  if (source?.id === 'patristic') {
    const firstLine = commentary.text.split('\n')[0] ?? '';
    const candidate = firstLine.split(/\s+[—–-]\s+|:/)[0]?.trim() ?? '';
    return (
      PATRISTIC_FATHERS[candidate.toLowerCase()] ??
      (candidate ? candidate.slice(0, 40) : own(SOURCES, 'patristic')?.commentator ?? 'Padres da Igreja')
    );
  }
  const registered = source ? own(SOURCES, source.id)?.commentator : undefined;
  if (registered) return registered;
  const author = source?.author ?? source?.title ?? commentary.source_id;
  // "Matthew Henry (1662-1714)" -> "Matthew Henry"
  return author.replace(/\s*\(.*$/, '').split(/[,;]/)[0]!.trim().slice(0, 40);
}

/** Rótulo pt-BR da tradição; tradição fora do registro segue como veio. */
export function traditionLabel(id: string | null | undefined): string {
  if (!id) return '';
  return own(TRADITIONS, id)?.pt ?? id;
}

/** Ids das fontes de texto corrido que o leitor oferece (BLivre, KJV), na ordem do registro. */
export function textSources(): string[] {
  return Object.keys(SOURCES).filter((id) => SOURCES[id]!.role === 'text');
}
