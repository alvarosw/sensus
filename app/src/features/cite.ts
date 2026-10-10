import { t, type StringKey } from '@/i18n';

const CITE_LABEL: Record<string, StringKey> = {
  txt: 'cite.txt',
  tok: 'cite.tok',
  lex: 'cite.lex',
  com: 'cite.com',
  dic: 'cite.dic',
  xr: 'cite.xr',
  ent: 'cite.ent',
  src: 'cite.src',
};

/**
 * Rótulo legível de um cite_id. Formatos: txt:{source}:{vid}, lex:{source}:{key},
 * com:{source}:..., dic:{source}:..., xr:{source}:..., ent:{source}:...
 * Tokens (tok:{corpus}:...) não carregam a fonte no id.
 */
export function citeLabel(citeId: string, titleOf: (sourceId: string) => string | undefined): string {
  const [prefix, sourceId] = citeId.split(':');
  const key = CITE_LABEL[prefix];
  const base = key ? t(key) : citeId;
  if (prefix === 'tok' || !sourceId) return base;
  return `${base} · ${titleOf(sourceId) ?? sourceId}`;
}
