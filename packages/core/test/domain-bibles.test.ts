// Catálogo de Bíblias baixáveis: validação, recomendação por idioma e sigla. Catálogo de exemplo com pt, en, es,
// zh-Hans e zh-Hant (o idioma do app decide a recomendada; as demais vêm agrupadas por idioma).
import { describe, expect, it } from 'vitest';
import { BibleCatalogError, bibleAbbr, bibleCiteShort, parseBibleCatalog, recommendBibles, type BibleCatalog } from '../src/index';

const SHA = 'a'.repeat(64);

function entry(id: string, lang: string, rank: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    abbr: id.toUpperCase(),
    name: `Bíblia ${id}`,
    lang,
    license: 'Public Domain',
    license_url: null,
    attribution: 'Atribuição de teste',
    url: 'https://example.test/bible',
    version: '2026.11.06',
    testaments: ['OT', 'NT'],
    rank,
    package: {
      url: `https://example.test/bible-${id}.zip`,
      sha256: SHA,
      size: 3_000_000,
      uncompressed_size: 9_000_000,
    },
    ...extra,
  };
}

function catalogInput(bibles: unknown[]): Record<string, unknown> {
  return { catalog_version: '2026.11.06', schema_version: 1, bibles };
}

const EXEMPLO_BIBLES: Record<string, unknown>[] = [
  entry('en-web', 'en', 1),
  entry('cuv-hant', 'zh-Hant', 1),
  entry('rvr1909', 'es', 1),
  entry('blivre', 'pt', 1, { bundled: true, package: undefined }),
  entry('lsg1910', 'de', 1),
  entry('cuv-hans', 'zh-Hans', 2),
  entry('rvr1960', 'es', 2),
  entry('kjv', 'en', 2, { bundled: true, package: undefined }),
  entry('nvi', 'pt', 2),
  entry('ru-synod', 'ru', 1),
];
const EXEMPLO = catalogInput(EXEMPLO_BIBLES);

function exemplo(): BibleCatalog {
  return parseBibleCatalog(EXEMPLO);
}

describe('parseBibleCatalog', () => {
  it('aceita o catálogo de exemplo e normaliza o sha256 para minúsculas', () => {
    const c = parseBibleCatalog(catalogInput([entry('nvi', 'pt', 1, { package: { ...(entry('x', 'pt', 1).package as object), sha256: 'A'.repeat(64) } })]));
    expect(c.catalog_version).toBe('2026.11.06');
    expect(c.bibles[0]!.package!.sha256).toBe('a'.repeat(64));
    expect(exemplo().bibles).toHaveLength(EXEMPLO_BIBLES.length);
  });

  it('bundled sem pacote é válido; Bíblia não bundled sem pacote é erro', () => {
    expect(parseBibleCatalog(catalogInput([entry('blivre', 'pt', 1, { bundled: true, package: undefined })])).bibles[0]!.bundled).toBe(true);
    expect(() => parseBibleCatalog(catalogInput([entry('nvi', 'pt', 1, { package: undefined })]))).toThrow(/package ausente/);
  });

  it('recusa id com caracteres que não são nome de arquivo seguro', () => {
    expect(() => parseBibleCatalog(catalogInput([entry('../etc', 'pt', 1)]))).toThrow(/id "..\/etc" inválido/);
    expect(() => parseBibleCatalog(catalogInput([entry('Nvi', 'pt', 1)]))).toThrow(/inválido/);
  });

  it('recusa sha256 malformado, URL que não é http(s) e tamanho zero', () => {
    const badSha = entry('nvi', 'pt', 1, { package: { ...(entry('x', 'pt', 1).package as object), sha256: 'abc' } });
    expect(() => parseBibleCatalog(catalogInput([badSha]))).toThrow(/sha256 inválido/);
    const badUrl = entry('nvi', 'pt', 1, { url: 'ftp://exemplo' });
    expect(() => parseBibleCatalog(catalogInput([badUrl]))).toThrow(/url não é uma URL http\(s\)/);
    const zero = entry('nvi', 'pt', 1, { package: { ...(entry('x', 'pt', 1).package as object), size: 0 } });
    expect(() => parseBibleCatalog(catalogInput([zero]))).toThrow(/size deve ser um inteiro positivo/);
  });

  it('recusa idioma inválido, testamento desconhecido e id repetido', () => {
    expect(() => parseBibleCatalog(catalogInput([entry('nvi', 'português', 1)]))).toThrow(/não é um código de idioma/);
    expect(() => parseBibleCatalog(catalogInput([entry('nvi', 'pt', 1, { testaments: ['AT'] })]))).toThrow(/aceita só OT ou NT/);
    expect(() => parseBibleCatalog(catalogInput([entry('nvi', 'pt', 1), entry('nvi', 'pt', 2)]))).toThrow(/repetido: nvi/);
  });

  it('recusa esquema de catálogo que este app não lê e entrada que não é objeto', () => {
    expect(() => parseBibleCatalog({ ...EXEMPLO, schema_version: 2 })).toThrow(/esquema 2/);
    expect(() => parseBibleCatalog(catalogInput(['texto']))).toThrow(BibleCatalogError);
    expect(() => parseBibleCatalog(null)).toThrow(/não é um objeto/);
  });

  it('mensagem aponta a entrada com problema', () => {
    expect(() => parseBibleCatalog(catalogInput([entry('nvi', 'pt', 1), entry('rvr', 'es', 0)]))).toThrow(/bibles\[1\] \(rvr\)\.rank/);
  });
});

describe('recommendBibles', () => {
  it('idioma pt: a recomendada (rank 1) vem primeiro e as demais de pt seguem por rank', () => {
    const r = recommendBibles(exemplo(), 'pt');
    expect(r.recommended.map((b) => b.id)).toEqual(['blivre', 'nvi']);
    expect(r.recommended[0]!.rank).toBe(1);
  });

  it('demais idiomas agrupados por idioma, sem repetir a recomendada', () => {
    const r = recommendBibles(exemplo(), 'pt');
    expect(r.others.map((g) => g.lang)).toEqual(['en', 'zh', 'es', 'de', 'ru']);
    expect(r.others.find((g) => g.lang === 'es')!.bibles.map((b) => b.id)).toEqual(['rvr1909', 'rvr1960']);
    const todos = [...r.recommended, ...r.others.flatMap((g) => g.bibles)].map((b) => b.id);
    expect(todos.sort()).toEqual(EXEMPLO_BIBLES.map((b) => String(b.id)).sort());
  });

  it('idioma chinês (zh-Hans) trata zh-Hans e zh-Hant como o mesmo idioma; a de rank 1 vem antes', () => {
    const r = recommendBibles(exemplo(), 'zh-Hans');
    expect(r.recommended.map((b) => b.id)).toEqual(['cuv-hant', 'cuv-hans']);
    expect(r.others.some((g) => g.lang === 'zh')).toBe(false);
    expect(r.others.map((g) => g.lang)).toContain('pt');
  });

  it('idioma sem Bíblia no catálogo: nada recomendado, tudo agrupado', () => {
    const r = recommendBibles(exemplo(), 'hi');
    expect(r.recommended).toEqual([]);
    expect(r.others.reduce((n, g) => n + g.bibles.length, 0)).toBe(EXEMPLO_BIBLES.length);
  });

  it('idioma com região (en-US) usa o código base', () => {
    expect(recommendBibles(exemplo(), 'en-US').recommended.map((b) => b.id)).toEqual(['en-web', 'kjv']);
  });
});

describe('bibleAbbr', () => {
  const catalog = exemplo();

  it('BLivre e KJV têm a sigla do registro de fontes', () => {
    expect(bibleAbbr('blivre', null)).toBe('BLivre');
    expect(bibleAbbr('kjv', catalog)).toBe('KJV');
  });

  it('Bíblia baixada usa a sigla do catálogo; sem catálogo, o id', () => {
    expect(bibleAbbr('rvr1909', catalog)).toBe('RVR1909');
    expect(bibleAbbr('rvr1909', null)).toBe('rvr1909');
    expect(bibleAbbr('inexistente', catalog)).toBe('inexistente');
  });
});

describe('bibleCiteShort', () => {
  const catalog = exemplo();

  it('Bíblia do registro usa o nome curto (Bíblia Livre), não a sigla', () => {
    expect(bibleCiteShort('blivre', catalog)).toBe('Bíblia Livre');
  });

  it('Bíblia baixada usa a sigla do catálogo; sem catálogo, o id', () => {
    expect(bibleCiteShort('rvr1909', catalog)).toBe('RVR1909');
    expect(bibleCiteShort('rvr1909', null)).toBe('rvr1909');
  });
});
