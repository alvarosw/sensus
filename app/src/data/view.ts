// Textos de situação derivados do estado (puros, testáveis).
import { DATA_COPY } from './strings';
import type { MachineState } from './download-machine';
import { formatMB } from './plan';
import type { Edition } from './edition';

export function percentOf(s: Pick<MachineState, 'bytes' | 'total'>): number {
  if (s.total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((s.bytes / s.total) * 100)));
}

/** Linha da tela Configurações: situação atual dos dados de estudo. */
export function dataRowSubtitle(input: {
  machine: Pick<MachineState, 'phase' | 'bytes' | 'total'>;
  edition: Edition | null;
  installedVersion: string | null;
  downloadBytes: number | null;
}): string {
  const { machine, edition } = input;
  if (machine.phase === 'downloading') return DATA_COPY.rowDownloading(percentOf(machine));
  if (edition === 'full') return DATA_COPY.rowInstalled(input.installedVersion);
  const size = input.downloadBytes !== null ? formatMB(input.downloadBytes) : DATA_COPY.sizeUnknown;
  return DATA_COPY.rowNotInstalled(size);
}

/** Texto de progresso "24,5 MB de 72 MB" para o download em andamento. */
export function progressLine(s: Pick<MachineState, 'bytes' | 'total'>): string {
  return DATA_COPY.progressOf(formatMB(s.bytes), s.total > 0 ? formatMB(s.total) : '?');
}
