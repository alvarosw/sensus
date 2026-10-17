// Combinações prontas do paralelo (ids reais da cronologia, fonte theographic) e a escolha das linhas que abrem o
// paralelo e as que entram depois. Puro, para ser testado sem a tela.

const T = 'ent:theographic:';

/** Combinações prontas: aparecem na entrada só para completar a lista enquanto o usuário tem poucas próprias. */
export const PARALLEL_COMBOS: ReadonlyArray<{ id: string; name: string; lines: readonly string[] }> = [
  { id: 'judah-israel', name: 'Judá e Israel', lines: [`${T}rec5W0YtPdi4yrvaY`, `${T}rec3R4qyFlVjCRORt`] },
  { id: 'jesus-paul', name: 'Jesus e Paulo', lines: [`${T}recgkFqZovgbr3pAi`, `${T}recgkzNX07a7kGFYL`] },
  {
    id: 'paul-journeys',
    name: 'Viagens de Paulo',
    lines: [`${T}recUWXmZlrKxIx99u`, `${T}reciR4wcxOAcLxak0`, `${T}rec4bAiAcAOo9mPwO`],
  },
  { id: 'jerusalem-samaria', name: 'Jerusalém e Samaria', lines: [`${T}recL1WV82pXaRBQ59`, `${T}recEP3QZ3HUmIkv4Q`] },
  {
    id: 'abraham-joseph-moses',
    name: 'Abraão, José e Moisés',
    lines: [`${T}reccdFYIq50NyxNej`, `${T}rechuDYJoK32gmrME`, `${T}recjNRR60PAuFtjha`],
  },
];

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
