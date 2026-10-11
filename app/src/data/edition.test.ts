// Edição do banco e validação do banco baixado. Puro.
import { describe, expect, it } from 'vitest';
import { checkFullDatabase, editionOf, SUPPORTED_SCHEMA_VERSION } from './edition';

describe('editionOf', () => {
  it('reader só quando declarado; sem meta.edition é full (bancos antigos)', () => {
    expect(editionOf({ edition: 'reader' })).toBe('reader');
    expect(editionOf({ edition: 'full' })).toBe('full');
    expect(editionOf({})).toBe('full');
  });
});

describe('checkFullDatabase', () => {
  const full = { edition: 'full', schema_version: String(SUPPORTED_SCHEMA_VERSION) };
  it('aceita edição full com o esquema suportado', () => {
    expect(checkFullDatabase(full)).toBe('ok');
  });
  it('sem meta legível: corrupt', () => {
    expect(checkFullDatabase(null)).toBe('corrupt');
    expect(checkFullDatabase({})).toBe('corrupt');
  });
  it('reader ou sem edição não entra como completo', () => {
    expect(checkFullDatabase({ ...full, edition: 'reader' })).toBe('edition');
    expect(checkFullDatabase({ schema_version: '2' })).toBe('edition');
  });
  it('esquema diferente: schema', () => {
    expect(checkFullDatabase({ ...full, schema_version: String(SUPPORTED_SCHEMA_VERSION - 1) })).toBe('schema');
    expect(checkFullDatabase({ edition: 'full' })).toBe('schema');
  });
});
