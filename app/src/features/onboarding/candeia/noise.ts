// Tremulação da chama: ruído suave em uma dimensão (valor com interpolação suave, em oitavas), sem período
// visível. Roda na thread de UI (worklets) e é puro: mesmo tempo e semente, mesmo resultado.

/** Pseudoaleatório em [0, 1) para um inteiro. */
export function hash1(n: number): number {
  'worklet';
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/** Ruído de valor suave em [-1, 1]. */
export function noise1(x: number): number {
  'worklet';
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10); // quíntica: derivada contínua, sem "quinas" no movimento
  const a = hash1(i);
  const b = hash1(i + 1);
  return (a + (b - a) * u) * 2 - 1;
}

/** Três oitavas de ruído com razões de frequência irracionais (√5, π/√2): nunca se alinham num laço. */
export function fbm1(x: number): number {
  'worklet';
  return noise1(x) * 0.6 + noise1(x * 2.2360679 + 13.7) * 0.28 + noise1(x * 4.9348022 + 41.3) * 0.12;
}

export interface Flicker {
  /** Altura da chama (1 = repouso). */
  scaleY: number;
  /** Largura da chama (1 = repouso). */
  scaleX: number;
  /** Inclinação da ponta em graus (positivo = ponta para a direita). */
  sway: number;
  /** Intensidade da luz (1 = repouso), para a poça de luz e o halo. */
  intensity: number;
}

/**
 * Estado da chama no tempo `t` (segundos). `seed` separa chamas e camadas; `amount` escala a tremulação
 * (1 = normal; "reduzir movimento" usa bem menos). Rajadas lentas de vez em quando deixam a chama mais inquieta,
 * como uma corrente de ar que passa.
 */
export function flicker(t: number, seed: number, amount = 1): Flicker {
  'worklet';
  const fast = fbm1(t * 2.1 + seed);
  const faster = fbm1(t * 5.3 + seed * 1.7 + 19.1);
  const slow = noise1(t * 0.37 + seed * 0.61 + 7.3);
  const gust = slow > 0.15 ? (slow - 0.15) * (slow - 0.15) * 2.6 : 0; // 0..~1,9, só às vezes
  const k = amount;
  return {
    scaleY: 1 + k * (0.07 * fast + 0.045 * faster * (0.4 + gust)),
    scaleX: 1 + k * (-0.04 * fast + 0.025 * faster),
    sway: k * (2.2 * fast + 3.2 * faster * (0.35 + gust)),
    intensity: 1 + k * (0.07 * fast + 0.035 * faster - 0.05 * gust * Math.abs(faster)),
  };
}
