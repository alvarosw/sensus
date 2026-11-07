// Registro único de fontes e tradições: nomes curtos e longos, comentaristas, papel de cada fonte e rótulos pt-BR.
// Dono de todo rótulo de fonte (citações, leitor, lentes, painel da IA) e da regra de nome do comentarista.
// Fonte nova: uma entrada em SOURCES (e, se a tradição for nova, em TRADITIONS) + linha em DATA_LICENSES.md.
// O teste packages/core/test/domain-sources.test.ts falha se faltar rótulo.
import type { Commentary, Source } from '../types';
import { appLangInfo, DEFAULT_APP_LANG, fallbackChain, isAppLang, type AppLang } from './locale';

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
  // Nomes em português derivados da Bíblia Livre (pipeline/ingest/nomes_pt.py); entity_name, não entity.
  'sensus-nomes-pt': { short: 'Nomes (BLivre)', role: 'entity', lang: 'pt' },
  // Títulos pt dos eventos (pipeline/ingest/titulos_pt.py), revisados por pessoa; entity_name com cite_id de evento.
  'sensus-titulos-pt': { short: 'Títulos (Theographic)', role: 'entity', lang: 'pt' },
  // Descrições em pt (pipeline/ingest/descricoes_pt.py): TIPNR por regra; Theographic e OpenBible revisadas por IA.
  // entity_text (não entity_name).
  'sensus-descricoes-pt': { short: 'Descrições (pt)', role: 'entity', lang: 'pt' },
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
  'egw-thoughts': { short: 'O Maior Discurso de Cristo', commentator: 'Ellen G. White · O Maior Discurso de Cristo', role: 'commentary', lang: 'en' },
  'smith-daniel': { short: 'Daniel e Apocalipse', commentator: 'Uriah Smith · Daniel e Apocalipse', role: 'commentary', lang: 'en' },
  // Segunda leva (pipeline/ingest/adventist_pd.py). Títulos pt: O Desejado de Todas as Nações é o nome da edição
  // brasileira; os demais são traduções do título inglês, sem conferir edição brasileira.
  'egw-desire-of-ages': { short: 'O Desejado de Todas as Nações', commentator: 'Ellen G. White · O Desejado de Todas as Nações', role: 'commentary', lang: 'en' },
  // Haskell (Daniel, o Profeta; O Vidente de Patmos): fora do build até a limpeza das citações de margem do scan
  // (ver pipeline/ingest/adventist_pd.py, PENDENTES). Voltar aqui junto com a staging.
  'waggoner-galatians': { short: 'As Boas Novas', commentator: 'E. J. Waggoner · As Boas Novas', role: 'commentary', lang: 'en' },
  'waggoner-christ': { short: 'Cristo e Sua Justiça', commentator: 'E. J. Waggoner · Cristo e Sua Justiça', role: 'commentary', lang: 'en' },
  'andrews-sabbath': { short: 'História do Sábado', commentator: 'J. N. Andrews · História do Sábado', role: 'commentary', lang: 'en' },
  'smith-us-prophecy': { short: 'Estados Unidos na Profecia', commentator: 'Uriah Smith · Estados Unidos na Profecia', role: 'commentary', lang: 'en' },
  'smith-sanctuary': { short: 'O Santuário e os 2.300 Dias', commentator: 'Uriah Smith · O Santuário e os 2.300 Dias', role: 'commentary', lang: 'en' },
};

/** Ordem de preferência das fontes de lugares (menor = melhor) para escolher a identificação moderna. */
const PLACE_SOURCE_ORDER: readonly string[] = ['openbible-geo', 'theographic', 'stepbible-tipnr'];

/** Posição da fonte de lugares na preferência; fontes fora da lista ficam por último (9). */
export function placeSourceRank(sourceId: string): number {
  const i = PLACE_SOURCE_ORDER.indexOf(sourceId);
  return i < 0 ? 9 : i;
}

/**
 * Rótulos das tradições por idioma (o valor vem do pipeline, campo `source.tradition`). `pt` é obrigatório; idioma
 * sem rótulo cai no inglês e depois no português (traditionLabel). Rótulos fora de pt e en: a revisar por falante
 * nativo (docs/design/idiomas-biblias-fontes.md §0).
 */
export const TRADITIONS: Readonly<Record<string, { pt: string } & Partial<Record<AppLang, string>>>> = {
  reformed: { pt: 'reformada', en: 'Reformed', zh: '改革宗', hi: 'रिफॉर्म्ड', es: 'reformada', ar: 'مُصلَحة', fr: 'réformée', bn: 'রিফর্মড', ru: 'реформатская', id: 'Reformed', ur: 'ریفارمڈ', de: 'reformiert', ja: '改革派', vi: 'Cải cách' },
  'reformed-baptist': { pt: 'batista reformada', en: 'Reformed Baptist', zh: '改革宗浸信会', hi: 'रिफॉर्म्ड बैपटिस्ट', es: 'bautista reformada', ar: 'معمدانية مُصلَحة', fr: 'baptiste réformée', bn: 'রিফর্মড ব্যাপটিস্ট', ru: 'реформатско-баптистская', id: 'Baptis Reformed', ur: 'ریفارمڈ بپٹسٹ', de: 'reformiert-baptistisch', ja: '改革派バプテスト', vi: 'Báp-tít Cải cách' },
  presbyterian: { pt: 'presbiteriana', en: 'Presbyterian', zh: '长老会', hi: 'प्रेस्बिटेरियन', es: 'presbiteriana', ar: 'مشيخية', fr: 'presbytérienne', bn: 'প্রেসবিটেরিয়ান', ru: 'пресвитерианская', id: 'Presbiterian', ur: 'پریسبیٹیرین', de: 'presbyterianisch', ja: '長老派', vi: 'Trưởng Lão' },
  methodist: { pt: 'metodista', en: 'Methodist', zh: '卫理公会', hi: 'मेथोडिस्ट', es: 'metodista', ar: 'ميثودية', fr: 'méthodiste', bn: 'মেথডিস্ট', ru: 'методистская', id: 'Metodis', ur: 'میتھوڈسٹ', de: 'methodistisch', ja: 'メソジスト', vi: 'Giám Lý' },
  baptist: { pt: 'batista', en: 'Baptist', zh: '浸信会', hi: 'बैपटिस्ट', es: 'bautista', ar: 'معمدانية', fr: 'baptiste', bn: 'ব্যাপটিস্ট', ru: 'баптистская', id: 'Baptis', ur: 'بپٹسٹ', de: 'baptistisch', ja: 'バプテスト', vi: 'Báp-tít' },
  dispensational: { pt: 'dispensacionalista', en: 'Dispensationalist', zh: '时代论', hi: 'डिस्पेंसेशनल', es: 'dispensacionalista', ar: 'تدبيرية', fr: 'dispensationaliste', bn: 'ডিসপেনসেশনাল', ru: 'диспенсационалистская', id: 'Dispensasional', ur: 'ڈسپنسیشنل', de: 'dispensationalistisch', ja: 'ディスペンセーション主義', vi: 'Thời kỳ luận' },
  patristic: { pt: 'patrística', en: 'Patristic', zh: '教父', hi: 'पैट्रिस्टिक', es: 'patrística', ar: 'آبائية', fr: 'patristique', bn: 'প্যাট্রিস্টিক', ru: 'патристическая', id: 'Patristik', ur: 'آبائے کلیسیا', de: 'patristisch', ja: '教父', vi: 'Giáo phụ' },
  adventist: { pt: 'adventista', en: 'Adventist', zh: '复临派', hi: 'एडवेंटिस्ट', es: 'adventista', ar: 'سبتية أدفنتستية', fr: 'adventiste', bn: 'অ্যাডভেন্টিস্ট', ru: 'адвентистская', id: 'Advent', ur: 'ایڈونٹسٹ', de: 'adventistisch', ja: 'アドベンチスト', vi: 'Cơ Đốc Phục Lâm' },
  catholic: { pt: 'católica', en: 'Catholic', zh: '天主教', hi: 'कैथोलिक', es: 'católica', ar: 'كاثوليكية', fr: 'catholique', bn: 'ক্যাথলিক', ru: 'католическая', id: 'Katolik', ur: 'کیتھولک', de: 'katholisch', ja: 'カトリック', vi: 'Công giáo' },
  lutheran: { pt: 'luterana', en: 'Lutheran', zh: '路德宗', hi: 'लूथरन', es: 'luterana', ar: 'لوثرية', fr: 'luthérienne', bn: 'লুথেরান', ru: 'лютеранская', id: 'Lutheran', ur: 'لوتھرن', de: 'lutherisch', ja: 'ルター派', vi: 'Luther' },
  anglican: { pt: 'anglicana', en: 'Anglican', zh: '圣公会', hi: 'एंग्लिकन', es: 'anglicana', ar: 'أنجليكانية', fr: 'anglicane', bn: 'অ্যাংলিকান', ru: 'англиканская', id: 'Anglikan', ur: 'اینگلیکن', de: 'anglikanisch', ja: '聖公会', vi: 'Anh giáo' },
  congregational: { pt: 'congregacional', en: 'Congregational', zh: '公理会', hi: 'कॉन्ग्रिगेशनल', es: 'congregacionalista', ar: 'تجمعية', fr: 'congrégationaliste', bn: 'কংগ্রিগেশনাল', ru: 'конгрегационалистская', id: 'Kongregasional', ur: 'کانگریگیشنل', de: 'kongregationalistisch', ja: '会衆派', vi: 'Giáo đoàn' },
  restoration: { pt: 'restauracionista', en: 'Restorationist', zh: '复原运动', hi: 'पुनर्स्थापन आंदोलन', es: 'restauracionista', ar: 'حركة الاسترداد', fr: 'restaurationniste', bn: 'পুনরুদ্ধার আন্দোলন', ru: 'реставрационистская', id: 'Gerakan Pemulihan', ur: 'بحالی تحریک', de: 'restaurationistisch', ja: '回復運動', vi: 'Phong trào Phục hồi' },
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

/**
 * Rótulo da tradição no idioma pedido (padrão pt). Sem rótulo nesse idioma, cai no inglês e depois no português;
 * tradição fora do registro segue como veio.
 */
export function traditionLabel(id: string | null | undefined, lang: AppLang = DEFAULT_APP_LANG): string {
  if (!id) return '';
  const entry = own(TRADITIONS, id);
  if (!entry) return id;
  for (const l of fallbackChain(lang)) {
    const text = entry[l];
    if (text) return text;
  }
  return entry.pt;
}

/** Código principal de um idioma BCP-47 em minúsculas ("en-US" -> "en"); null sem idioma. */
export function langBase(lang: string | null | undefined): string | null {
  const base = lang?.trim().toLowerCase().split(/[-_]/)[0];
  return base ? base : null;
}

/**
 * Idioma da fonte. Vale o do registro (`SOURCES`); fonte fora do registro usa o `lang` que veio do banco (`fallback`).
 */
export function sourceLangOf(id: string | null | undefined, fallback?: string | null): string | null {
  if (!id) return langBase(fallback);
  const registered = own(SOURCES, id)?.lang;
  return langBase(registered ?? fallback);
}

/** Par de idiomas de uma tradução automática: de qual língua (origem) para qual (o idioma do app). */
export interface TranslationPair {
  from: AppLang;
  to: AppLang;
}

/**
 * Traduz um texto de `sourceLang` para o idioma do app? Verdadeiro quando as bases diferem e os dois idiomas têm
 * modelo no ML Kit (campo `mlkit` de APP_LANGS). Origem fora dos 14 idiomas do app (grego, hebraico, aramaico) nunca
 * é traduzida. Sem `appLang` (chamadas antigas), vale o comportamento de antes: inglês para português.
 */
export function needsTranslation(sourceLang: string | null | undefined, appLang?: AppLang | null): boolean {
  const from = langBase(sourceLang);
  if (appLang === undefined || appLang === null) return from === 'en';
  if (!from || !isAppLang(from) || !isAppLang(appLang) || from === appLang) return false;
  return appLangInfo(from).mlkit !== null && appLangInfo(appLang).mlkit !== null;
}

/** Par da tradução (origem -> idioma do app), ou null quando não há o que traduzir (ver needsTranslation). */
export function translationPair(sourceLang: string | null | undefined, appLang: AppLang): TranslationPair | null {
  if (!needsTranslation(sourceLang, appLang)) return null;
  return { from: langBase(sourceLang) as AppLang, to: appLang };
}

/** Idioma pivô dos modelos de tradução: o inglês (o modelo dele é compartilhado por todos os pares). */
export const MODEL_PIVOT: AppLang = 'en';

/** Par do modelo que a Configuração gerencia: inglês -> idioma do app. Null quando o app já está em inglês. */
export function modelPairOf(appLang: AppLang): TranslationPair | null {
  return appLang === MODEL_PIVOT ? null : { from: MODEL_PIVOT, to: appLang };
}

/**
 * A fonte pode ser traduzida automaticamente para o idioma do app? Decide pelo idioma registrado da fonte, nunca pelo
 * id nem por suposição (a linha do tempo, por exemplo, pergunta por `theographic`). `fallback` é o idioma do banco, só
 * para fonte fora do registro. Sem `appLang`, vale o inglês para português (ver needsTranslation).
 */
export function isTranslatableSource(
  id: string | null | undefined,
  fallback?: string | null,
  appLang?: AppLang | null,
): boolean {
  return needsTranslation(sourceLangOf(id, fallback), appLang);
}

/** Ids das fontes de texto corrido que o leitor oferece (BLivre, KJV), na ordem do registro. */
export function textSources(): string[] {
  return Object.keys(SOURCES).filter((id) => SOURCES[id]!.role === 'text');
}
