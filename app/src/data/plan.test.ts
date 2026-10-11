// Regras de planejamento: faixas Range, espaço necessário, formatação e oferta da tela de primeira vez.
import { describe, expect, it } from 'vitest';
import { CHUNK_BYTES, chunkRanges, formatMB, hasSpace, rangeHeader, shouldPromptFirstRun, spaceNeeded, SPACE_MARGIN_BYTES } from './plan';
import { parseManifest } from './manifest';

const MANIFEST = parseManifest({
  data_version: '2026.10.11',
  schema_version: 2,
  min_app_version: '1.0.0',
  full: { url: 'https://example.com/f.zip', sha256: 'b'.repeat(64), size: 25_000_000, uncompressed_size: 72_000_000 },
});

describe('chunkRanges', () => {
  it('cobre o arquivo inteiro sem sobreposição', () => {
    const total = CHUNK_BYTES * 2 + 10;
    const r = chunkRanges(0, total);
    expect(r).toEqual([
      { start: 0, end: CHUNK_BYTES - 1 },
      { start: CHUNK_BYTES, end: CHUNK_BYTES * 2 - 1 },
      { start: CHUNK_BYTES * 2, end: total - 1 },
    ]);
    expect(r.reduce((n, x) => n + (x.end - x.start + 1), 0)).toBe(total);
  });

  it('retomar começa do offset gravado', () => {
    const r = chunkRanges(CHUNK_BYTES + 5, CHUNK_BYTES * 3);
    expect(r[0]).toEqual({ start: CHUNK_BYTES + 5, end: CHUNK_BYTES * 2 + 4 });
    expect(r.at(-1)!.end).toBe(CHUNK_BYTES * 3 - 1);
  });

  it('vazio quando nada falta', () => {
    expect(chunkRanges(100, 100)).toEqual([]);
    expect(chunkRanges(200, 100)).toEqual([]);
  });

  it('monta o cabeçalho Range com faixa inclusiva', () => {
    expect(rangeHeader({ start: 0, end: 99 })).toBe('bytes=0-99');
  });
});

describe('espaço', () => {
  it('exige o que falta do ZIP, o banco descompactado e a folga', () => {
    expect(spaceNeeded(25_000_000, 72_000_000)).toBe(25_000_000 + 72_000_000 + SPACE_MARGIN_BYTES);
    expect(spaceNeeded(-1, 10)).toBe(10 + SPACE_MARGIN_BYTES);
  });

  it('hasSpace compara o livre com o necessário', () => {
    expect(hasSpace(100, 100)).toBe(true);
    expect(hasSpace(99, 100)).toBe(false);
  });
});

describe('formatMB', () => {
  it('usa vírgula e uma casa abaixo de 100 MB', () => {
    expect(formatMB(24_500_000)).toBe('24,5 MB');
    expect(formatMB(1_000_000)).toBe('1 MB');
    expect(formatMB(500_000)).toBe('0,5 MB');
    expect(formatMB(72_400_000)).toBe('72,4 MB');
  });
  it('arredonda a partir de 100 MB', () => {
    expect(formatMB(150_400_000)).toBe('150 MB');
  });
});

describe('shouldPromptFirstRun', () => {
  const base = { activeEdition: 'reader' as const, installedVersion: null, manifest: MANIFEST, deferredVersion: null };

  it('primeira abertura sem dados completos: oferece', () => {
    expect(shouldPromptFirstRun(base)).toBe(true);
  });

  it('sem manifesto (offline ou não publicado): não oferece', () => {
    expect(shouldPromptFirstRun({ ...base, manifest: null })).toBe(false);
  });

  it('"Depois" na mesma versão: não repete; versão nova: oferece de novo', () => {
    expect(shouldPromptFirstRun({ ...base, deferredVersion: '2026.10.11' })).toBe(false);
    expect(shouldPromptFirstRun({ ...base, deferredVersion: '2026.10.01' })).toBe(true);
  });

  it('dados completos instalados mais antigos que o manifesto: oferece a atualização', () => {
    expect(shouldPromptFirstRun({ ...base, activeEdition: 'full', installedVersion: '2026.10.01' })).toBe(true);
  });

  it('dados completos em dia ou de versão desconhecida: não oferece', () => {
    expect(shouldPromptFirstRun({ ...base, activeEdition: 'full', installedVersion: '2026.10.11' })).toBe(false);
    expect(shouldPromptFirstRun({ ...base, activeEdition: 'full', installedVersion: null })).toBe(false);
  });
});
