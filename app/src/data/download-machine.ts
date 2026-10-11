// Máquina de estados do download e instalação dos dados de estudo. Pura: só transições, sem IO.
// Fases ativas (checking..installing) são do motor; 'paused' guarda o parcial para retomar;
// 'error' guarda o motivo. Eventos fora de hora são ignorados (a mesma máquina é devolvida).

export type DataError =
  | 'manifest' // não foi possível obter o manifesto (sem rede ou resposta inválida)
  | 'network' // a conexão caiu durante o download (com repetições esgotadas)
  | 'space' // espaço livre insuficiente
  | 'app-too-old' // o app é mais antigo que o mínimo do manifesto
  | 'schema' // o esquema dos dados não é o que o app lê
  | 'checksum' // o ZIP não bate com o sha256 (após as tentativas)
  | 'corrupt' // o ZIP ou o banco extraído não abrem / não batem com o tamanho
  | 'install' // falha ao trocar o banco instalado
  | 'unsupported'; // plataforma sem download (web)

export type Phase = 'idle' | 'checking' | 'downloading' | 'verifying' | 'extracting' | 'installing' | 'paused' | 'done' | 'error';

export type PauseReason = 'user' | 'network' | 'interrupted';

export interface MachineState {
  phase: Phase;
  /** Bytes do ZIP já gravados no parcial. */
  bytes: number;
  /** Tamanho total do ZIP (0 se desconhecido). */
  total: number;
  /** Tentativa atual de download (sobe quando o sha256 não confere). */
  attempt: number;
  pause?: PauseReason;
  error?: DataError;
}

/** Downloads com sha256 divergente são refeitos uma vez; na segunda falha, erro 'checksum'. */
export const MAX_ATTEMPTS = 2;

export type MachineEvent =
  | { type: 'start' }
  | { type: 'manifest' }
  | { type: 'bytes'; bytes: number; total: number }
  | { type: 'downloaded' }
  | { type: 'mismatch' }
  | { type: 'verified' }
  | { type: 'extracted' }
  | { type: 'installed' }
  | { type: 'pause'; reason: PauseReason }
  | { type: 'fail'; error: DataError }
  | { type: 'interrupted'; bytes: number; total: number }
  | { type: 'reset' };

export const IDLE_STATE: MachineState = { phase: 'idle', bytes: 0, total: 0, attempt: 1 };

/** Fases em que o motor está trabalhando (botões de ação ficam indisponíveis). */
export function isActive(phase: Phase): boolean {
  return phase === 'checking' || phase === 'downloading' || phase === 'verifying' || phase === 'extracting' || phase === 'installing';
}

/** Pode iniciar (ou retomar) a partir desta fase. */
export function canStart(phase: Phase): boolean {
  return phase === 'idle' || phase === 'paused' || phase === 'error' || phase === 'done';
}

/** Próximo estado para o evento; devolve o mesmo objeto quando a transição não existe. */
export function reduce(s: MachineState, e: MachineEvent): MachineState {
  switch (e.type) {
    case 'start':
      if (!canStart(s.phase)) return s;
      return { ...s, phase: 'checking', attempt: 1, pause: undefined, error: undefined, bytes: s.phase === 'done' ? 0 : s.bytes };

    case 'manifest':
      return s.phase === 'checking' ? { ...s, phase: 'downloading' } : s;

    case 'bytes':
      return s.phase === 'downloading' ? { ...s, bytes: e.bytes, total: e.total } : s;

    case 'downloaded':
      return s.phase === 'downloading' ? { ...s, phase: 'verifying' } : s;

    case 'mismatch':
      if (s.phase !== 'verifying') return s;
      if (s.attempt < MAX_ATTEMPTS) return { ...s, phase: 'downloading', attempt: s.attempt + 1, bytes: 0 };
      return { ...s, phase: 'error', error: 'checksum' };

    case 'verified':
      return s.phase === 'verifying' ? { ...s, phase: 'extracting' } : s;

    case 'extracted':
      return s.phase === 'extracting' ? { ...s, phase: 'installing' } : s;

    case 'installed':
      return s.phase === 'installing' ? { ...s, phase: 'done', bytes: s.total, pause: undefined, error: undefined } : s;

    case 'pause':
      if (s.phase !== 'checking' && s.phase !== 'downloading') return s;
      return { ...s, phase: 'paused', pause: e.reason };

    case 'fail':
      if (!isActive(s.phase)) return s;
      return { ...s, phase: 'error', error: e.error, pause: undefined };

    case 'interrupted':
      if (s.phase !== 'idle') return s;
      return { ...s, phase: 'paused', pause: 'interrupted', bytes: e.bytes, total: e.total };

    case 'reset':
      if (isActive(s.phase)) return s;
      return { ...IDLE_STATE };
  }
}
