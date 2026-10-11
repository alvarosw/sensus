// Fontes do banco (tabela source) para a tela Sobre e a lista de fontes e licenças.
import { useEffect, useState } from 'react';
import type { Source } from '@sensus/core';
import { useRepo } from '@/data/db-context';

export function useSources(): { sources: Source[] | null; error: boolean } {
  const repo = useRepo();
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    repo.sources().then(
      (rows) => alive && setSources(rows),
      () => alive && (setError(true), setSources([])),
    );
    return () => {
      alive = false;
    };
  }, [repo]);
  return { sources, error };
}

/** Grupo de licença para a lista: Creative Commons, uso não comercial, domínio público, outras. */
export type LicenseGroup = 'cc' | 'nc' | 'pd' | 'other';

export function licenseGroupOf(license: string): LicenseGroup {
  if (/non-?commercial|não comercial/i.test(license)) return 'nc';
  if (/^CC[ -]|creative commons/i.test(license)) return 'cc';
  if (/public domain|dom[ií]nio/i.test(license)) return 'pd';
  return 'other';
}
