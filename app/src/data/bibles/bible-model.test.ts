// Regras puras das Bíblias baixadas: arquivos, ordem da lista, texto padrão (preferência textSource), meta do banco
// extraído e linha de cada Bíblia.
import { describe, expect, it } from 'vitest';
import { parseBibleCatalog, type BibleCatalog } from '@sensus/core';
import {
  bibleFileName,
  bibleIdOfFile,
  bibleRowInfo,
  bibleStagedFileName,
  checkBibleMeta,
  installedBibleIds,
  langName,
  resolveTextSource,
} from './bible-model';

const SHA = 'b'.repeat(64);

function pkg(id: string, size: number) {
  return { url: `https://example.test/bible-${id}.zip`, sha256: SHA, size, uncompressed_size: size * 3 };
}

function catalog(): BibleCatalog {
  return parseBibleCatalog({
    catalog_version: '2026.11.06',
    schema_version: 1,
    bibles: [
      { id: 'blivre', abbr: 'BLivre', name: 'Bíblia Livre', lang: 'pt', license: 'CC', attribution: 'x', url: 'https://example.test', version: '1', testaments: ['OT', 'NT'], rank: 1, bundled: true },
      { id: 'nvi', abbr: 'NVI', name: 'Nova Versão Internacional', lang: 'pt', license: 'Comercial', attribution: 'x', url: 'https://example.test', version: '1', testaments: ['OT', 'NT'], rank: 2, package: pkg('nvi', 4_000_000) },
      { id: 'rvr1909', abbr: 'RVR1909', name: 'Reina-Valera 1909', lang: 'es', license: 'Public Domain', attribution: 'x', url: 'https://example.test', version: '2026.11.06', testaments: ['OT', 'NT'], rank: 1, package: pkg('rvr1909', 3_000_000) },
      { id: 'lsg1910', abbr: 'LSG1910', name: 'Luther 1912', lang: 'de', license: 'Public Domain', attribution: 'x', url: 'https://example.test', version: '1', testaments: ['OT', 'NT'], rank: 1, package: pkg('lsg1910', 3_500_000) },
    ],
  });
}

describe('nomes de arquivo', () => {
  it('banco da Bíblia e provisório', () => {
    expect(bibleFileName('rvr1909')).toBe('bible-rvr1909.db');
    expect(bibleStagedFileName('rvr1909')).toBe('bible-rvr1909.db.new');
  });

  it('reconhece só o banco final, não sidecars, provisórios nem o banco completo', () => {
    expect(bibleIdOfFile('bible-rvr1909.db')).toBe('rvr1909');
    expect(bibleIdOfFile('bible-rvr1909.db.new')).toBeNull();
    expect(bibleIdOfFile('bible-rvr1909.db-wal')).toBeNull();
    expect(bibleIdOfFile('sensus-full.db')).toBeNull();
    expect(bibleIdOfFile('bible-../x.db')).toBeNull();
  });
});

describe('installedBibleIds', () => {
  it('lista do banco principal primeiro e as baixadas na ordem do catálogo', () => {
    const files = ['bible-lsg1910.db', 'sensus.db', 'bible-rvr1909.db', 'bible-rvr1909.db-wal'];
    expect(installedBibleIds(files, ['blivre', 'kjv'], catalog())).toEqual(['blivre', 'kjv', 'rvr1909', 'lsg1910']);
  });

  it('sem catálogo, as baixadas seguem por id; não repete as do banco principal', () => {
    const files = ['bible-rvr1909.db', 'bible-blivre.db', 'bible-aaa.db'];
    expect(installedBibleIds(files, ['blivre', 'kjv'], null)).toEqual(['blivre', 'kjv', 'aaa', 'rvr1909']);
  });

  it('sem arquivos baixados, só o banco principal', () => {
    expect(installedBibleIds([], ['blivre', 'kjv'], catalog())).toEqual(['blivre', 'kjv']);
  });
});

describe('resolveTextSource (preferência textSource)', () => {
  const cat = catalog();
  const installed = ['blivre', 'kjv', 'rvr1909'];

  it('mantém a escolhida enquanto estiver instalada (qualquer id instalado, não só BLivre e KJV)', () => {
    expect(resolveTextSource({ stored: 'rvr1909', installed, catalog: cat, lang: 'pt' })).toBe('rvr1909');
    expect(resolveTextSource({ stored: 'kjv', installed, catalog: cat, lang: 'pt' })).toBe('kjv');
  });

  it('Bíblia removida: volta para a recomendada instalada do idioma do app', () => {
    // a removida foi a lsg1910; o app está em espanhol e a recomendada instalada é rvr1909
    expect(resolveTextSource({ stored: 'lsg1910', installed, catalog: cat, lang: 'es' })).toBe('rvr1909');
  });

  it('Bíblia removida sem recomendada instalada do idioma: BLivre', () => {
    expect(resolveTextSource({ stored: 'nvi', installed: ['blivre', 'kjv'], catalog: cat, lang: 'pt' })).toBe('blivre');
    expect(resolveTextSource({ stored: 'rvr1909', installed: ['blivre', 'kjv'], catalog: cat, lang: 'es' })).toBe('blivre');
  });

  it('sem preferência gravada ou sem catálogo: BLivre (ou a recomendada instalada, se houver catálogo)', () => {
    expect(resolveTextSource({ stored: null, installed, catalog: cat, lang: 'pt' })).toBe('blivre');
    expect(resolveTextSource({ stored: 'rvr1909', installed, catalog: null, lang: 'es' })).toBe('rvr1909');
    expect(resolveTextSource({ stored: 'rvr1909', installed: ['blivre', 'kjv'], catalog: null, lang: 'es' })).toBe('blivre');
    expect(resolveTextSource({ stored: null, installed, catalog: null, lang: 'es' })).toBe('blivre');
  });

  it('a escolha da recomendada respeita a ordem de rank entre as instaladas do idioma', () => {
    // nvi (rank 2) e blivre (rank 1), ambas pt: sem a blivre instalada, a nvi é a recomendada instalada
    expect(resolveTextSource({ stored: null, installed: ['kjv', 'nvi'], catalog: cat, lang: 'pt' })).toBe('nvi');
  });
});

describe('checkBibleMeta', () => {
  const expected = { id: 'rvr1909', version: '2026.11.06' };
  const ok = { bible_id: 'rvr1909', version: '2026.11.06', schema_version: '1', lang: 'es' };

  it('aceita a meta que confere com o catálogo', () => {
    expect(checkBibleMeta(ok, expected)).toBe('ok');
  });

  it('sem meta, o banco está corrompido', () => {
    expect(checkBibleMeta({}, expected)).toBe('corrupt');
  });

  it('esquema diferente do que o app lê', () => {
    expect(checkBibleMeta({ ...ok, schema_version: '2' }, expected)).toBe('schema');
  });

  it('id ou versão diferentes do anunciado pelo catálogo', () => {
    expect(checkBibleMeta({ ...ok, bible_id: 'nvi' }, expected)).toBe('mismatch');
    expect(checkBibleMeta({ ...ok, version: '2025.01.01' }, expected)).toBe('mismatch');
  });
});

describe('langName', () => {
  it('nome do idioma pelo código base', () => {
    expect(langName('es')).toBe('Espanhol');
    expect(langName('zh-Hans')).toBe('Chinês');
    expect(langName('pt-BR')).toBe('Português');
  });

  it('código fora da lista aparece em maiúsculas', () => {
    expect(langName('xx')).toBe('XX');
  });
});

describe('bibleRowInfo', () => {
  it('BLivre e KJV: nome e sigla do registro, sempre instaladas (não removíveis)', () => {
    const blivre = bibleRowInfo('blivre', null);
    expect(blivre).toMatchObject({ abbr: 'BLivre', name: 'Bíblia Livre', lang: 'pt', bundled: true, downloadable: false });
    const kjv = bibleRowInfo('kjv', catalog());
    expect(kjv).toMatchObject({ abbr: 'KJV', name: 'King James Version', lang: 'en', bundled: true });
  });

  it('Bíblia do catálogo: dados e tamanho do pacote', () => {
    expect(bibleRowInfo('rvr1909', catalog())).toEqual({
      id: 'rvr1909',
      abbr: 'RVR1909',
      name: 'Reina-Valera 1909',
      lang: 'es',
      license: 'Public Domain',
      sizeBytes: 3_000_000,
      bundled: false,
      downloadable: true,
    });
  });

  it('Bíblia instalada que saiu do catálogo: sigla e nome do id', () => {
    const info = bibleRowInfo('antiga', catalog());
    expect(info).toMatchObject({ abbr: 'antiga', name: 'antiga', bundled: false, downloadable: false, license: null });
  });
});
