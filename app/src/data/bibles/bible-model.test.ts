// Regras puras das Bíblias baixadas: arquivos, ordem da lista, texto padrão (preferência textSource), meta do banco
// extraído e linha de cada Bíblia.
import { describe, expect, it } from 'vitest';
import { parseBibleCatalog, type BibleCatalog } from '@sensus/core';
import {
  bibleFileName,
  bibleHasUpdate,
  bibleIdOfFile,
  bibleRowInfo,
  compareBibleVersions,
  bibleStagedFileName,
  canRemoveBible,
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
  it('só as baixadas, na ordem do catálogo (nenhuma vem com o app)', () => {
    const files = ['bible-lsg1910.db', 'sensus.db', 'bible-rvr1909.db', 'bible-rvr1909.db-wal', 'bible-blivre.db'];
    expect(installedBibleIds(files, catalog())).toEqual(['blivre', 'rvr1909', 'lsg1910']);
  });

  it('sem catálogo, seguem por id', () => {
    const files = ['bible-rvr1909.db', 'bible-blivre.db', 'bible-aaa.db'];
    expect(installedBibleIds(files, null)).toEqual(['aaa', 'blivre', 'rvr1909']);
  });

  it('sem arquivos baixados, nenhuma', () => {
    expect(installedBibleIds(['sensus.db'], catalog())).toEqual([]);
  });
});

describe('resolveTextSource (Bíblia principal)', () => {
  const cat = catalog();
  const installed = ['blivre', 'kjv', 'rvr1909'];

  it('mantém a escolhida enquanto estiver instalada', () => {
    expect(resolveTextSource({ stored: 'rvr1909', installed, catalog: cat, lang: 'pt' })).toBe('rvr1909');
    expect(resolveTextSource({ stored: 'kjv', installed, catalog: cat, lang: 'pt' })).toBe('kjv');
  });

  it('Bíblia removida: volta para a recomendada instalada do idioma do app', () => {
    // a removida foi a lsg1910; o app está em espanhol e a recomendada instalada é rvr1909
    expect(resolveTextSource({ stored: 'lsg1910', installed, catalog: cat, lang: 'es' })).toBe('rvr1909');
  });

  it('sem recomendada instalada do idioma: a primeira instalada', () => {
    expect(resolveTextSource({ stored: 'nvi', installed: ['kjv', 'blivre'], catalog: cat, lang: 'de' })).toBe('kjv');
    expect(resolveTextSource({ stored: 'blivre', installed: ['rvr1909'], catalog: null, lang: 'pt' })).toBe('rvr1909');
  });

  it('a primeira baixada vira a principal (preferência antiga de quem não tem nenhuma instalada)', () => {
    expect(resolveTextSource({ stored: 'blivre', installed: ['lsg1910'], catalog: cat, lang: 'pt' })).toBe('lsg1910');
  });

  it('nenhuma instalada: BLivre (só os dados completos trazem o texto dela)', () => {
    expect(resolveTextSource({ stored: 'rvr1909', installed: [], catalog: cat, lang: 'es' })).toBe('blivre');
    expect(resolveTextSource({ stored: null, installed: [], catalog: null, lang: 'en' })).toBe('blivre');
  });

  it('a escolha da recomendada respeita a ordem de rank entre as instaladas do idioma', () => {
    // nvi (rank 2) e blivre (rank 1), ambas pt: sem a blivre instalada, a nvi é a recomendada instalada
    expect(resolveTextSource({ stored: null, installed: ['kjv', 'nvi'], catalog: cat, lang: 'pt' })).toBe('nvi');
    expect(resolveTextSource({ stored: null, installed, catalog: cat, lang: 'pt' })).toBe('blivre');
  });
});

describe('canRemoveBible', () => {
  it('remove qualquer instalada, menos a única', () => {
    expect(canRemoveBible('kjv', ['kjv', 'blivre'])).toBe(true);
    expect(canRemoveBible('kjv', ['kjv'])).toBe(false);
    expect(canRemoveBible('nvi', ['kjv', 'blivre'])).toBe(false);
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
    expect(langName('es')).toBe('Español');
    expect(langName('zh-Hans')).toBe('中文（简体）');
    expect(langName('pt-BR')).toBe('Português');
  });

  it('código fora da lista aparece em maiúsculas', () => {
    expect(langName('xx')).toBe('XX');
  });
});

describe('bibleRowInfo', () => {
  it('fora do catálogo, BLivre e KJV usam nome e sigla do registro', () => {
    expect(bibleRowInfo('blivre', null)).toMatchObject({ abbr: 'BLivre', name: 'Bíblia Livre', lang: 'pt', downloadable: false });
    expect(bibleRowInfo('kjv', catalog())).toMatchObject({ abbr: 'KJV', name: 'King James Version', lang: 'en' });
  });

  it('Bíblia do catálogo: dados e tamanho do pacote', () => {
    expect(bibleRowInfo('rvr1909', catalog())).toEqual({
      id: 'rvr1909',
      abbr: 'RVR1909',
      name: 'Reina-Valera 1909',
      lang: 'es',
      license: 'Public Domain',
      sizeBytes: 3_000_000,
      downloadable: true,
    });
  });

  it('entrada antiga sem pacote (bundled) não é baixável', () => {
    expect(bibleRowInfo('blivre', catalog())).toMatchObject({ abbr: 'BLivre', downloadable: false });
  });

  it('Bíblia instalada que saiu do catálogo: sigla e nome do id', () => {
    const info = bibleRowInfo('antiga', catalog());
    expect(info).toMatchObject({ abbr: 'antiga', name: 'antiga', downloadable: false, license: null });
  });
});

describe('versões e atualização de Bíblia instalada', () => {
  it('compara versões número a número (11 é mais nova que 9) e aceita trechos a mais', () => {
    expect(compareBibleVersions('2026.11.06', '2026.11.06')).toBe(0);
    expect(compareBibleVersions('2026.11.07', '2026.11.06')).toBeGreaterThan(0);
    expect(compareBibleVersions('2026.9.1', '2026.11.1')).toBeLessThan(0);
    expect(compareBibleVersions('2026.11', '2026.11.06')).toBeLessThan(0);
    expect(compareBibleVersions('2026.11.06.1', '2026.11.06')).toBeGreaterThan(0);
    expect(compareBibleVersions('2026.11.06-b', '2026.11.06-a')).toBeGreaterThan(0);
  });

  it('há atualização só com versão do catálogo mais nova que a instalada', () => {
    const cat = catalog();
    const rvr = cat.bibles.find((b) => b.id === 'rvr1909');
    expect(bibleHasUpdate(rvr, '2026.11.05')).toBe(true);
    expect(bibleHasUpdate(rvr, '2026.11.06')).toBe(false);
    // Instalada mais nova que o catálogo (ex.: catálogo voltou): não oferece downgrade.
    expect(bibleHasUpdate(rvr, '2026.12.01')).toBe(false);
  });

  it('versão instalada desconhecida, Bíblia sem pacote ou ausente do catálogo não geram atualização', () => {
    const cat = catalog();
    const nvi = cat.bibles.find((b) => b.id === 'nvi');
    const blivre = cat.bibles.find((b) => b.id === 'blivre');
    expect(bibleHasUpdate(nvi, null)).toBe(false);
    expect(bibleHasUpdate(nvi, undefined)).toBe(false);
    expect(bibleHasUpdate(nvi, '0')).toBe(true);
    expect(bibleHasUpdate(blivre, '0')).toBe(false);
    expect(bibleHasUpdate(null, '0')).toBe(false);
  });
});
