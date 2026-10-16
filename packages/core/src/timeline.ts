// Linha do tempo: formatação das datas dos eventos (a consulta fica em Repo.timelineEvents).

/**
 * Data de um evento como texto para o leitor: "-4003" → "4003 a.C.", "0047" ou "0047-05-01" → "47 d.C.".
 * Mês e dia são descartados (a linha do tempo mostra só o ano). Formato não reconhecido, ou ano zero
 * (não existe na fonte), devolve null.
 */
export function formatEventDate(startDate: string | null | undefined): string | null {
  const m = /^(-?)(\d+)(?:-\d{1,2}-\d{1,2})?$/.exec(startDate?.trim() ?? '');
  if (!m) return null;
  const year = Number(m[2]);
  if (year === 0) return null;
  return m[1] ? `${year} a.C.` : `${year} d.C.`;
}
