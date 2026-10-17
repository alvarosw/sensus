// Peças comuns às lentes da folha: corpo com carregamento e erro, cartões, "anexar ao chat" e rótulos de seção.
import type { ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { SECTION_LABELS, sourceShort, type PanelData } from '@sensus/core';
import { LinkButton, Skeleton, Txt, space } from '@/design';
import { useStudy, type LensKey } from '@/state/study';
import type { StudyData } from '../useStudyData';
import { STUDY } from '../strings';

export interface LensProps {
  onLayout?: (e: LayoutChangeEvent) => void;
}

/** Quantos itens cabem na lente antes de "Ver todos". */
export const SHOWN = 3;
/** Linhas da linha do tempo antes de "Ver todos" (inclui os eventos de contexto). */
export const TIMELINE_SHOWN = 8;

export const SECTION_LABEL: Record<LensKey, string> = {
  visao: 'Visão geral',
  texto: SECTION_LABELS.texto,
  literario: SECTION_LABELS.literario,
  historico: SECTION_LABELS.historico,
  lingua: SECTION_LABELS.lingua,
  intertexto: SECTION_LABELS.intertexto,
  interpretacao: SECTION_LABELS.interpretacao,
  aplicacao: SECTION_LABELS.aplicacao,
};

export function shortOf(panel: PanelData, sourceId: string): string {
  return sourceShort(sourceId, panel.sources[sourceId]?.title);
}

/** Anexa um cartão ao chat e abre o chat. */
export function attachCard(id: string, label: string, text?: string, citeIds?: string[]) {
  const st = useStudy.getState();
  st.attach({ id, kind: 'card', label, citeIds: citeIds ?? [id], text });
  st.openChat();
}

export function useExpanded(lens: string): boolean {
  return useStudy((s) => !!s.expanded[lens]);
}

export function Cards({ children }: { children: ReactNode }) {
  return <View style={{ gap: space[4] }}>{children}</View>;
}

export function Loading({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (error) {
    return (
      <View style={{ gap: space[3] }}>
        <Txt v="bodySm" color="danger">{STUDY.panelError}</Txt>
        <View style={{ flexDirection: 'row' }}>
          <LinkButton label={STUDY.retry} onPress={onRetry} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: space[4] }}>
      <Skeleton width="60%" />
      <Skeleton width="90%" height={48} />
    </View>
  );
}

/** Corpo carregando/erro; senão, children(panel). */
export function Body({ data, children }: { data: StudyData; children: (panel: PanelData) => ReactNode }) {
  if (!data.panel) return <Loading error={data.error} onRetry={data.reload} />;
  return <>{children(data.panel)}</>;
}
