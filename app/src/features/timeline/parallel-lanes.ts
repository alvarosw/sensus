// Escolha das linhas do paralelo: combinações prontas (ids reais da cronologia, fonte theographic), linhas iniciais
// e inclusão sem repetir e sem passar do limite. Puro, para ser testado sem a tela.
import { PARALLEL_MAX_LANES } from './model';

const T = 'ent:theographic:';

/** Combinações prontas do estado vazio e do seletor. Os ids são os cite_ids das linhas no banco. */
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
 * Linhas que abrem o paralelo sem escolha do usuário: só a linha de origem (botão "Em paralelo" de uma linha),
 * senão as favoritas na ordem em que foram marcadas, até o limite. Ids que não existem no banco ficam de fora.
 */
export function initialLanes(origin: string | undefined, favorites: readonly string[], known: ReadonlySet<string>): string[] {
  if (origin) return known.has(origin) ? [origin] : [];
  return favorites.filter((id) => known.has(id)).slice(0, PARALLEL_MAX_LANES);
}

/** Acrescenta uma linha: sem repetir e sem passar do limite de linhas na tela. */
export function addLane(lanes: readonly string[], id: string): string[] {
  return lanes.includes(id) || lanes.length >= PARALLEL_MAX_LANES ? [...lanes] : [...lanes, id];
}
