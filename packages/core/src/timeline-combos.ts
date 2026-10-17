// Combinações de linhas do paralelo: as prontas (fixas, nunca gravadas), as do usuário (recentes e favoritas, gravadas
// em app-prefs) e a lista de cartões da entrada. Puro, para ser testado sem a tela. A ordem da lista de combinações
// do usuário é a de recência: a primeira é a mais nova (favoritas e recentes na mesma lista, separadas por `favorite`).

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

/** Combinação do usuário, gravada no aparelho. */
export interface UserCombo {
  id: string;
  name: string;
  /** cite_ids das linhas, na ordem em que apareceram no paralelo. */
  lines: string[];
  favorite: boolean;
}

/** Cartão da entrada: uma combinação do usuário ou uma pronta. */
export interface ComboCard {
  /** id da combinação do usuário, ou `ready:<id>` para a pronta. */
  id: string;
  name: string;
  lines: string[];
  source: 'mine' | 'ready';
  favorite: boolean;
}

/** Cartões na entrada, no total (as do usuário primeiro; as prontas só completam). */
export const COMBO_CARDS_MAX = 5;
/** Combinações não favoritadas guardadas: as últimas, as anteriores saem. */
export const RECENT_COMBOS_MAX = 5;
/** Favoritas guardadas (um limite alto, só para o arquivo não crescer sem controle). */
export const FAVORITE_COMBOS_MAX = 200;

/** Chave de uma combinação: as mesmas linhas, em qualquer ordem, são a mesma combinação. */
export function comboKey(lines: readonly string[]): string {
  return [...new Set(lines)].sort().join('|');
}

/** Nome padrão de uma combinação: os nomes das linhas. */
export function defaultComboName(names: readonly string[]): string {
  return names.filter(Boolean).join(' · ');
}

/** Id novo para uma combinação gravada. */
export function newComboId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Mantém todas as favoritas (até o limite) e só as recentes mais novas (as primeiras da lista). */
export function trimRecents(list: readonly UserCombo[]): UserCombo[] {
  let favorites = 0;
  let recents = 0;
  return list.filter((c) => (c.favorite ? favorites++ < FAVORITE_COMBOS_MAX : recents++ < RECENT_COMBOS_MAX));
}

/**
 * Confirmar uma combinação a torna recente (no topo). Se as mesmas linhas já são recentes, sobem para o topo; se já
 * são favoritas, nada muda.
 */
export function recordRecent(list: readonly UserCombo[], lines: readonly string[], name: string, id: string): UserCombo[] {
  const key = comboKey(lines);
  const same = list.find((c) => comboKey(c.lines) === key);
  if (same?.favorite) return [...list];
  const entry: UserCombo = same ? same : { id, name, lines: [...new Set(lines)], favorite: false };
  return trimRecents([entry, ...list.filter((c) => c !== same)]);
}

/**
 * Favoritar: as mesmas linhas viram favoritas com o nome dado (uma recente ou pronta vira do usuário). Sem repetir.
 */
export function favoriteCombo(list: readonly UserCombo[], lines: readonly string[], name: string, id: string): UserCombo[] {
  const key = comboKey(lines);
  const same = list.find((c) => comboKey(c.lines) === key);
  const entry: UserCombo = same
    ? { ...same, name, favorite: true }
    : { id, name, lines: [...new Set(lines)], favorite: true };
  return trimRecents([entry, ...list.filter((c) => c !== same)]);
}

/** Desfavoritar: a combinação continua guardada como recente (no topo das recentes). */
export function unfavoriteCombo(list: readonly UserCombo[], id: string): UserCombo[] {
  const target = list.find((c) => c.id === id);
  if (!target?.favorite) return [...list];
  return trimRecents([{ ...target, favorite: false }, ...list.filter((c) => c !== target)]);
}

/** Remove uma combinação do usuário. */
export function removeCombo(list: readonly UserCombo[], id: string): UserCombo[] {
  return list.filter((c) => c.id !== id);
}

/**
 * Cartões da entrada: favoritas, depois recentes, e as prontas que ainda não são do usuário para completar até o
 * limite. Uma pronta sai quando o usuário já tem a mesma combinação (criada ou favoritada).
 */
export function buildCards(
  saved: readonly UserCombo[],
  ready: ReadonlyArray<{ id: string; name: string; lines: readonly string[] }> = PARALLEL_COMBOS,
  max: number = COMBO_CARDS_MAX,
): ComboCard[] {
  const mine = (c: UserCombo): ComboCard => ({ id: c.id, name: c.name, lines: [...c.lines], source: 'mine', favorite: c.favorite });
  const used = new Set(saved.map((c) => comboKey(c.lines)));
  const pronta = ready
    .filter((r) => !used.has(comboKey(r.lines)))
    .map((r): ComboCard => ({ id: `ready:${r.id}`, name: r.name, lines: [...r.lines], source: 'ready', favorite: false }));
  return [...saved.filter((c) => c.favorite).map(mine), ...saved.filter((c) => !c.favorite).map(mine), ...pronta].slice(0, max);
}

/** Confirmar só com pelo menos uma linha escolhida. */
export function canConfirm(selected: readonly string[]): boolean {
  return selected.length > 0;
}

/** Lê o que está gravado: só combinações válidas (id, linhas), sem repetir, dentro dos limites. Outro formato: vazio. */
export function parseCombos(value: unknown): UserCombo[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: UserCombo[] = [];
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const lines = Array.isArray(o.lines) ? [...new Set(o.lines.filter((x): x is string => typeof x === 'string' && x.length > 0))] : [];
    if (typeof o.id !== 'string' || o.id.length === 0 || lines.length === 0) continue;
    const key = comboKey(lines);
    if (seen.has(key)) continue;
    seen.add(key);
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'Combinação';
    out.push({ id: o.id, name, lines, favorite: o.favorite === true });
  }
  return trimRecents(out);
}
