// Manifesto: validação do JSON, comparação de versões e compatibilidade com o app. Puro.
import { describe, expect, it } from 'vitest';
import { ManifestError, appMeetsMinimum, compareVersions, parseManifest, updateState, type DataManifest } from './manifest';

const SHA = 'a'.repeat(64);
const VALID = {
  data_version: '2026.10.11',
  schema_version: 2,
  min_app_version: '1.0.0',
  full: { url: 'https://example.com/sensus-full.zip', sha256: SHA.toUpperCase(), size: 25_000_000, uncompressed_size: 72_000_000 },
};

describe('parseManifest', () => {
  it('aceita o contrato e normaliza o sha256 para minúsculas', () => {
    const m = parseManifest(VALID);
    expect(m.data_version).toBe('2026.10.11');
    expect(m.full.sha256).toBe(SHA);
    expect(m.full.size).toBe(25_000_000);
    expect(m.full.uncompressed_size).toBe(72_000_000);
  });

  it('aceita md5 opcional (normalizado) e o omite quando ausente', () => {
    const withMd5 = parseManifest({ ...VALID, full: { ...VALID.full, md5: 'B'.repeat(32) } });
    expect(withMd5.full.md5).toBe('b'.repeat(32));
    expect(parseManifest(VALID).full.md5).toBeUndefined();
  });

  it('rejeita md5 malformado', () => {
    expect(() => parseManifest({ ...VALID, full: { ...VALID.full, md5: 'xyz' } })).toThrow(/md5/);
    expect(() => parseManifest({ ...VALID, full: { ...VALID.full, md5: 123 } })).toThrow(/md5/);
  });

  it('rejeita o que não é objeto', () => {
    expect(() => parseManifest(null)).toThrow(ManifestError);
    expect(() => parseManifest([])).toThrow(ManifestError);
    expect(() => parseManifest('texto')).toThrow(ManifestError);
  });

  it('rejeita campos ausentes ou de tipo errado', () => {
    expect(() => parseManifest({ ...VALID, data_version: '' })).toThrow(/data_version/);
    expect(() => parseManifest({ ...VALID, schema_version: '2' })).toThrow(/schema_version/);
    expect(() => parseManifest({ ...VALID, schema_version: 0 })).toThrow(/schema_version/);
    expect(() => parseManifest({ ...VALID, min_app_version: 'v1' })).toThrow(/min_app_version/);
    expect(() => parseManifest({ ...VALID, full: undefined })).toThrow(/full ausente/);
    expect(() => parseManifest({ ...VALID, full: { ...VALID.full, url: 'ftp://x' } })).toThrow(/url/);
    expect(() => parseManifest({ ...VALID, full: { ...VALID.full, sha256: 'abc' } })).toThrow(/sha256/);
    expect(() => parseManifest({ ...VALID, full: { ...VALID.full, size: 1.5 } })).toThrow(/full.size/);
    expect(() => parseManifest({ ...VALID, full: { ...VALID.full, uncompressed_size: -1 } })).toThrow(/uncompressed_size/);
  });
});

describe('compareVersions', () => {
  it('compara versões pontuadas pelos números, não pelo texto', () => {
    expect(compareVersions('2026.10.9', '2026.10.10')).toBe(-1);
    expect(compareVersions('2026.10.11', '2026.10.11')).toBe(0);
    expect(compareVersions('2.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
  });

  it('compara datas ISO e sufixos de build', () => {
    expect(compareVersions('2026-10-11T05:59:35+00:00', '2026-10-11T06:00:00+00:00')).toBe(-1);
    expect(compareVersions('2026.10.11-2', '2026.10.11-1')).toBe(1);
  });

  it('sem números, compara o texto', () => {
    expect(compareVersions('abc', 'abd')).toBe(-1);
    expect(compareVersions('x', 'x')).toBe(0);
  });
});

describe('appMeetsMinimum', () => {
  it('exige a versão mínima do manifesto', () => {
    expect(appMeetsMinimum('1.0.0', '1.0.0')).toBe(true);
    expect(appMeetsMinimum('1.2.0', '1.10.0')).toBe(false);
    expect(appMeetsMinimum('2.0.0', '1.10.0')).toBe(true);
  });
});

describe('updateState', () => {
  const m = parseManifest(VALID) as DataManifest;
  it('sem manifesto não há o que comparar', () => {
    expect(updateState('2026.10.01', true, null)).toBe('none');
  });
  it('sem dados completos, a atualização é sempre oferecida', () => {
    expect(updateState(null, false, m)).toBe('available');
  });
  it('instalado mais antigo: disponível; igual ou mais novo: em dia', () => {
    expect(updateState('2026.10.01', true, m)).toBe('available');
    expect(updateState('2026.10.11', true, m)).toBe('current');
    expect(updateState('2026.10.12', true, m)).toBe('current');
  });
  it('instalado sem versão conhecida', () => {
    expect(updateState(null, true, m)).toBe('unknown');
  });
});
