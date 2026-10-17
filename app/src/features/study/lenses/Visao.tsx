// Lente Visão geral: o fio da passagem (passos montados pelo modelo do fio).
import { useMemo } from 'react';
import { buildThread } from '../thread';
import { Thread } from '../Thread';
import { LensShell } from '../LensShell';
import { STUDY } from '../strings';
import { useStudyAi, useStudyData } from '../useStudyData';
import type { LensProps } from './shared';

export function VisaoLens({ onLayout }: LensProps) {
  const data = useStudyData();
  const ai = useStudyAi();
  const steps = useMemo(
    () => buildThread({ panel: data.panel, range: data.range, books: data.books, ai: { status: ai.status, summary: ai.summary } }),
    [data.panel, data.range, data.books, ai.status, ai.summary],
  );
  return (
    <LensShell
      lens="visao"
      title={STUDY.threadTitle}
      count={steps.length > 0 ? STUDY.stepsCount(steps.length) : undefined}
      summary={<Thread steps={steps} />}
      onLayout={onLayout}
    />
  );
}
