// Registros de fontes do banco (id -> Source), lidos uma vez por Repo. Usado para nome, idioma e tipo das fontes.
import type { Repo, Source } from '@sensus/core';
import { serial } from './serial';

const cache = new WeakMap<Repo, Promise<Map<string, Source>>>();

export function loadSources(repo: Repo): Promise<Map<string, Source>> {
  let p = cache.get(repo);
  if (!p) {
    p = serial(() => repo.sources()).then((rows) => new Map(rows.map((s) => [s.id, s])));
    cache.set(repo, p);
  }
  return p;
}
