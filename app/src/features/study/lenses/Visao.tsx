// Lente Visão geral: o fio da passagem (passos montados pelo modelo do fio).
// Não é uma caixa só: são partes irmãs na rolagem da folha (cabeçalho, abertura, um passo por lente, rodapé).
// Assim a âncora nativa (maintainVisibleContentPosition) segura o passo que está na tela quando um passo de cima
// cresce. A folha mede cada parte (onPartLayout) e soma as alturas para saber onde a lente começa.
import { useEffect, useMemo, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { space } from '@/design';
import { useLang } from '@/i18n/lang-store';
import { buildThread } from '../thread';
import { ThreadOpening, ThreadStep } from '../Thread';
import { LensDetail, LensTitle } from '../LensShell';
import { STUDY } from '../strings';
import { useStudyAi, useStudyData } from '../useStudyData';
import type { LensProps } from './shared';

/** Uma parte da Visão geral: filho direto da rolagem, medido pela folha pela sua chave. */
function Part({
  id,
  testID,
  style,
  onPartLayout,
  children,
}: {
  id: string;
  testID?: string;
  style: ViewStyle;
  onPartLayout?: LensProps['onPartLayout'];
  children: ReactNode;
}) {
  return (
    <View testID={testID} style={style} onLayout={(e: LayoutChangeEvent) => onPartLayout?.(id, e.nativeEvent.layout.height)}>
      {children}
    </View>
  );
}

export function VisaoLens({ onPartLayout, onPartKeys }: LensProps) {
  const data = useStudyData();
  const ai = useStudyAi();
  const appLang = useLang();
  const steps = useMemo(
    () => buildThread({ panel: data.panel, range: data.range, books: data.books, ai: { status: ai.status, summary: ai.summary }, appLang }),
    [data.panel, data.range, data.books, ai.status, ai.summary, appLang],
  );
  // A ordem das partes muda quando o número de passos muda: a folha precisa saber quais partes somar.
  const keys = ['head', 'open', ...steps.map((s) => `step-${s.lens}`), 'foot'];
  const keyList = keys.join('|');
  useEffect(() => {
    onPartKeys?.(keyList.split('|'));
  }, [keyList, onPartKeys]);

  return (
    <>
      {/* Cabeçalho: sem linha acima (a Visão geral é a primeira lente) e com o espaço que a casca dava. */}
      <Part id="head" testID="lens-visao" style={{ paddingTop: space[9], paddingHorizontal: 16, paddingBottom: space[6] }} onPartLayout={onPartLayout}>
        <LensTitle title={STUDY.threadTitle} count={steps.length > 0 ? STUDY.stepsCount(steps.length) : undefined} />
      </Part>

      <Part id="open" testID="thread" style={{ paddingHorizontal: 16, paddingBottom: space[6] }} onPartLayout={onPartLayout}>
        <ThreadOpening />
      </Part>

      {/* Marcador do início dos passos (sem altura). */}
      {steps.length > 0 && <View testID="thread-steps" />}
      {steps.map((s, i) => (
        <Part key={s.lens} id={`step-${s.lens}`} style={{ paddingHorizontal: 16 }} onPartLayout={onPartLayout}>
          <ThreadStep step={s} index={i} last={i === steps.length - 1} />
        </Part>
      ))}

      <Part id="foot" style={{ paddingHorizontal: 16, paddingBottom: space[3], gap: space[6] }} onPartLayout={onPartLayout}>
        <LensDetail lens="visao" />
      </Part>
    </>
  );
}
