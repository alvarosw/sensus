// Escolha das linhas que abrem o paralelo e as que entram depois. Puro, para ser testado sem a tela.
// As combinações prontas estão no núcleo (timeline-combos.ts).

/**
 * Linhas que abrem o paralelo: só a linha de origem (botão "Em paralelo" de uma linha). Sem origem, nada: a entrada
 * mostra as combinações. Id que não existe no banco fica de fora.
 */
export function initialLanes(origin: string | undefined, known: ReadonlySet<string>): string[] {
  if (origin) return known.has(origin) ? [origin] : [];
  return [];
}

/** Acrescenta uma linha sem repetir. Não há limite de linhas: o gráfico rola na vertical. */
export function addLane(lanes: readonly string[], id: string): string[] {
  return lanes.includes(id) ? [...lanes] : [...lanes, id];
}
