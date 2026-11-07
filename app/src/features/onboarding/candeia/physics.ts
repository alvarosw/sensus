// Física de carregar a candeia: a lâmpada segue o alvo (dedo ou caminho automático) com uma mola um pouco
// subamortecida, inclina na direção do movimento e balança ao parar, como algo levado na mão. A chama tem
// inércia própria: deita para trás quando a candeia anda rápido e se estica ao descer. Roda na thread de UI.

export interface LampSim {
  /** Posição do ponto de apoio da candeia (px). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Inclinação do corpo em graus (positivo = horário) e sua velocidade angular. */
  tilt: number;
  tiltV: number;
  /** Inclinação da chama em graus (positivo = ponta para a direita). */
  lean: number;
  /** Alongamento da chama (0 = repouso; positivo = mais alta e fina). */
  stretch: number;
}

export function restingSim(x: number, y: number): LampSim {
  'worklet';
  return { x, y, vx: 0, vy: 0, tilt: 0, tiltV: 0, lean: 0, stretch: 0 };
}

// Mola da posição: ~1,3 Hz, levemente subamortecida (passa um pouco do alvo e volta).
const K = 68;
const C = 2 * 0.74 * Math.sqrt(K);
// Pêndulo do corpo: mais mole e com pouco atrito, para o balanço depois de parar.
const KT = 48;
const CT = 2 * 0.3 * Math.sqrt(KT);
const MAX_TILT = 8;
const MAX_LEAN = 30;
const MAX_STRETCH = 0.22;
const STEP = 1 / 120;

function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return v < lo ? lo : v > hi ? hi : v;
}

/** Avança a simulação `dt` segundos em direção ao alvo (tx, ty). Estável para qualquer dt (subpassos). */
export function stepLamp(s: LampSim, tx: number, ty: number, dt: number): LampSim {
  'worklet';
  let { x, y, vx, vy, tilt, tiltV, lean, stretch } = s;
  let left = clamp(dt, 0, 0.1);
  while (left > 1e-6) {
    const h = left < STEP ? left : STEP;
    left -= h;
    const ax = K * (tx - x) - C * vx;
    const ay = K * (ty - y) - C * vy;
    vx += ax * h;
    vy += ay * h;
    x += vx * h;
    y += vy * h;
    // O corpo quer inclinar para onde vai (a mão adianta o pulso) e a aceleração dá o empurrão do pêndulo.
    const tiltTarget = clamp(vx * 0.017 + ax * 0.001, -MAX_TILT, MAX_TILT);
    const at = KT * (tiltTarget - tilt) - CT * tiltV;
    tiltV += at * h;
    tilt = clamp(tilt + tiltV * h, -MAX_TILT * 1.4, MAX_TILT * 1.4);
    // A chama fica para trás do movimento (o ar passa por ela) e reage depressa, mas não de estalo.
    const leanTarget = clamp(-vx * 0.05, -MAX_LEAN, MAX_LEAN);
    lean += (leanTarget - lean) * (1 - Math.exp(-h / 0.09));
    // Subindo, o ar empurra a chama para baixo (encolhe); descendo, ela se estica.
    const stretchTarget = clamp(vy * 0.0007 + Math.hypot(vx, vy) * 0.00012, -MAX_STRETCH, MAX_STRETCH);
    stretch += (stretchTarget - stretch) * (1 - Math.exp(-h / 0.12));
  }
  return { x, y, vx, vy, tilt, tiltV, lean, stretch };
}
