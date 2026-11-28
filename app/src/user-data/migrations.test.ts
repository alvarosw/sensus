import { describe, expect, it } from 'vitest';
import { USER_DB_VERSION, USER_MIGRATIONS } from './migrations';

describe('migrações do banco do usuário', () => {
  it('numeradas de 1 em diante, sem pular nem repetir', () => {
    USER_MIGRATIONS.forEach((m, i) => expect(m.version).toBe(i + 1));
    expect(USER_DB_VERSION).toBe(USER_MIGRATIONS.length);
  });

  it('a primeira cria a tabela de marcas sem guardar texto da Bíblia', () => {
    const sql = USER_MIGRATIONS[0]!.sql;
    expect(sql).toContain('CREATE TABLE marks');
    expect(sql).toMatch(/CHECK \(\(color IS NULL\) <> \(note IS NULL\)\)/);
    expect(sql).not.toMatch(/\btext\b\s+TEXT/i);
  });
});
