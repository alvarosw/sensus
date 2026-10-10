// Índice de citações: rótulos legíveis e determinísticos para cada cite_id do painel.
import type { Book, Commentary, PanelData, Source, Token } from '../types';
import { splitVid } from '../refs';
import { shortTitle } from './context';
import type { CiteIndex, CiteIndexEntry, RichTextContext } from './structured-types';
import type { SerializedContext } from './context';

/** Abreviações pt-BR dos livros, por OSIS (Fp, Jo, Mt, 1Co...). */
export const BOOK_ABBREVIATIONS: Readonly<Record<string, string>> = {
  Gen: 'Gn', Exod: 'Êx', Lev: 'Lv', Num: 'Nm', Deut: 'Dt', Josh: 'Js', Judg: 'Jz', Ruth: 'Rt',
  '1Sam': '1Sm', '2Sam': '2Sm', '1Kgs': '1Rs', '2Kgs': '2Rs', '1Chr': '1Cr', '2Chr': '2Cr',
  Ezra: 'Ed', Neh: 'Ne', Esth: 'Et', Job: 'Jó', Ps: 'Sl', Prov: 'Pv', Eccl: 'Ec', Song: 'Ct',
  Isa: 'Is', Jer: 'Jr', Lam: 'Lm', Ezek: 'Ez', Dan: 'Dn', Hos: 'Os', Joel: 'Jl', Amos: 'Am',
  Obad: 'Ob', Jonah: 'Jn', Mic: 'Mq', Nah: 'Na', Hab: 'Hc', Zeph: 'Sf', Hag: 'Ag', Zech: 'Zc', Mal: 'Ml',
  Matt: 'Mt', Mark: 'Mc', Luke: 'Lc', John: 'Jo', Acts: 'At', Rom: 'Rm', '1Cor': '1Co', '2Cor': '2Co',
  Gal: 'Gl', Eph: 'Ef', Phil: 'Fp', Col: 'Cl', '1Thess': '1Ts', '2Thess': '2Ts', '1Tim': '1Tm',
  '2Tim': '2Tm', Titus: 'Tt', Phlm: 'Fm', Heb: 'Hb', Jas: 'Tg', '1Pet': '1Pe', '2Pet': '2Pe',
  '1John': '1Jo', '2John': '2Jo', '3John': '3Jo', Jude: 'Jd', Rev: 'Ap',
};

/** Nomes curtos das fontes de texto e léxico (demais: título curto automático). */
const SOURCE_SHORT: Readonly<Record<string, string>> = {
  blivre: 'Bíblia Livre',
  kjv: 'KJV',
  'grc-tr': 'TR',
  tagnt: 'TAGNT',
  'stepbible-tbesg': 'TBESG',
  'stepbible-tflsj': 'LSJ',
  'sword-easton': 'Easton',
  'sword-isbe': 'ISBE',
  'sword-smith': 'Smith',
  'sword-hitchcock': 'Hitchcock',
  'sword-nave': 'Nave',
  'sword-torrey': 'Torrey',
  'sword-tsk': 'TSK',
  'openbible-xref': 'OpenBible',
};

/** Nome curto do comentarista, por fonte (os comentários da Patrística usam o nome do pai da igreja). */
const COMMENTATOR_SHORT: Readonly<Record<string, string>> = {
  'sword-calvincommentaries': 'Calvino',
  'sword-mhc': 'Matthew Henry',
  gill: 'Gill',
  'sword-scofield': 'Scofield',
  'sword-jfb': 'Jamieson-Fausset-Brown',
  'sword-barnes': 'Barnes',
  'sword-clarke': 'Clarke',
  'sword-wesley': 'Wesley',
  'sword-rwp': 'Robertson',
};

/** Pais da igreja: nome no primeiro trecho do comentário ("John Chrysostom — Homily...") -> nome em português. */
const FATHERS: Readonly<Record<string, string>> = {
  'john chrysostom': 'Crisóstomo',
  chrysostom: 'Crisóstomo',
  'augustine of hippo': 'Agostinho',
  augustine: 'Agostinho',
  jerome: 'Jerônimo',
  'ambrose of milan': 'Ambrósio de Milão',
  ambrose: 'Ambrósio',
  'origen': 'Orígenes',
  'irenaeus': 'Irineu',
  'tertullian': 'Tertuliano',
  'clement of alexandria': 'Clemente de Alexandria',
  'clement of rome': 'Clemente de Roma',
  'cyprian': 'Cipriano',
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

/** Ordem do livro -> OSIS, para os rótulos de versículo. */
function bookOf(books: readonly Book[], num: number): Book | undefined {
  return books.find((b) => b.num === num);
}

function abbreviationOf(books: readonly Book[], num: number): string {
  const book = bookOf(books, num);
  if (!book) return `Livro ${num}`;
  return BOOK_ABBREVIATIONS[book.osis] ?? book.name_pt;
}

/**
 * Referência de versículos: "2:5", "2:5–8", "2:5–3:1". O prefixo do livro entra quando `withBook` for true
 * (ex.: livro diferente do trecho, ou referências cruzadas).
 */
export function formatShortRef(
  startVid: number,
  endVid: number,
  books: readonly Book[],
  withBook: boolean,
): string {
  const s = splitVid(startVid);
  const e = splitVid(endVid);
  const prefix = withBook ? `${abbreviationOf(books, s.book)} ` : '';
  if (s.book !== e.book) {
    return `${prefix}${s.chapter}:${s.verse} – ${abbreviationOf(books, e.book)} ${e.chapter}:${e.verse}`;
  }
  if (s.chapter === e.chapter) {
    return s.verse === e.verse
      ? `${prefix}${s.chapter}:${s.verse}`
      : `${prefix}${s.chapter}:${s.verse}–${e.verse}`;
  }
  return `${prefix}${s.chapter}:${s.verse}–${e.chapter}:${e.verse}`;
}

/** Nome curto do comentário: comentarista conhecido, pai da igreja pelo primeiro trecho, ou autor da fonte. */
export function commentatorName(source: Source | undefined, commentary: Commentary): string {
  if (source?.id === 'patristic') {
    const firstLine = commentary.text.split('\n')[0] ?? '';
    const candidate = firstLine.split(/\s+[—–-]\s+|:/)[0]?.trim() ?? '';
    const key = candidate.toLowerCase();
    return FATHERS[key] ?? (candidate ? candidate.slice(0, 40) : 'Padres da Igreja');
  }
  if (source && COMMENTATOR_SHORT[source.id]) return COMMENTATOR_SHORT[source.id]!;
  const author = source?.author ?? source?.title ?? commentary.source_id;
  // "Matthew Henry (1662-1714)" -> "Matthew Henry"
  return author.replace(/\s*\(.*$/, '').split(/[,;]/)[0]!.trim().slice(0, 40);
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

/** Rótulo de palavra original: a forma sem pontuação de borda. */
function wordLabel(surface: string): string {
  return surface.normalize('NFC').replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '');
}

const DICTIONARY_SHORT_FALLBACK = (source: Source | undefined): string =>
  source ? shortTitle(source.title) : 'Dicionário';

/**
 * Constrói o índice de rótulos para todos os registros do painel. Determinístico: a mesma entrada
 * gera sempre os mesmos rótulos. Ids fora do painel não entram (serão tratados como inválidos).
 */
export function buildCiteIndex(panel: PanelData, books: Book[]): CiteIndex {
  const index: CiteIndex = new Map();
  const sources = panel.sources;
  const passageBook = splitVid(panel.range.start).book;
  const titleOf = (id: string): string => sources[id]?.title ?? id;
  const tradition = (id: string): string | null => sources[id]?.tradition ?? null;
  const add = (citeId: string, entry: CiteIndexEntry): void => {
    if (!index.has(citeId)) index.set(citeId, entry);
  };

  const verse = (v: { cite_id: string; source_id: string; vid: number }): void => {
    const short = SOURCE_SHORT[v.source_id] ?? shortTitle(titleOf(v.source_id));
    const refLabel = formatShortRef(v.vid, v.vid, books, splitVid(v.vid).book !== passageBook);
    add(v.cite_id, {
      label: `${short} ${refLabel}`,
      table: 'verse_text',
      sourceTitle: titleOf(v.source_id),
      tradition: tradition(v.source_id),
      short,
      refLabel,
      vid: v.vid,
    });
  };

  const { translations, original } = panel.layers.text;
  translations.forEach(verse);
  panel.layers.literary.before.forEach(verse);
  panel.layers.literary.after.forEach(verse);
  for (const samples of Object.values(panel.layers.language.concordance)) samples.samples.forEach(verse);
  for (const x of panel.layers.intertext.xrefs) x.texts.forEach(verse);

  for (const t of original as Token[]) {
    add(t.cite_id, {
      label: wordLabel(t.surface),
      table: 'token',
      sourceTitle: titleOf(t.source_id),
      tradition: tradition(t.source_id),
    });
  }

  for (const l of panel.layers.language.lexicon) {
    const short = SOURCE_SHORT[l.source_id] ?? shortTitle(titleOf(l.source_id));
    add(l.cite_id, {
      label: `${short} ${l.lemma ?? l.key}`,
      table: 'lexicon_entry',
      sourceTitle: titleOf(l.source_id),
      tradition: tradition(l.source_id),
      short,
    });
  }

  for (const c of panel.layers.interpretation.commentaries) {
    const name = commentatorName(sources[c.source_id], c);
    add(c.cite_id, {
      label: name,
      table: 'commentary',
      sourceTitle: titleOf(c.source_id),
      tradition: tradition(c.source_id),
      short: name,
    });
  }

  const dictionaryEntry = (d: { cite_id: string; source_id: string; headword: string }): void => {
    const short = SOURCE_SHORT[d.source_id] ?? DICTIONARY_SHORT_FALLBACK(sources[d.source_id]);
    add(d.cite_id, {
      label: `${short}: ${titleCaseHeadword(d.headword)}`,
      table: 'dictionary_entry',
      sourceTitle: titleOf(d.source_id),
      tradition: tradition(d.source_id),
      short,
    });
  };
  panel.layers.historical.dictionary.forEach(dictionaryEntry);
  panel.layers.literary.bookIntro.forEach(dictionaryEntry);
  panel.layers.intertext.topics.forEach(dictionaryEntry);

  for (const e of panel.layers.historical.entities) {
    add(e.cite_id, {
      label: e.name,
      table: 'entity',
      sourceTitle: titleOf(e.source_id),
      tradition: tradition(e.source_id),
    });
  }

  for (const x of panel.layers.intertext.xrefs) {
    const target = formatShortRef(x.to_start_vid, x.to_end_vid, books, true);
    const short = SOURCE_SHORT[x.source_id] ?? shortTitle(titleOf(x.source_id));
    add(x.cite_id, {
      label: target,
      table: 'xref',
      sourceTitle: titleOf(x.source_id),
      tradition: tradition(x.source_id),
      short,
      refLabel: target,
    });
  }

  return index;
}

/** Contexto de leitura da resposta a partir do contexto serializado e do painel. */
export function buildRichTextContext(
  context: Pick<SerializedContext, 'citeIds'>,
  panel: PanelData,
  books: Book[],
): RichTextContext {
  return {
    citeIds: context.citeIds,
    citeIndex: buildCiteIndex(panel, books),
    tokens: panel.layers.text.original,
  };
}
