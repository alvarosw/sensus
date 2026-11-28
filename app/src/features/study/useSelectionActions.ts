// Ações da barra da seleção (features/common/SelectionBar). Um lugar só para a lista, usado pelo "espiar" e pelo
// convite de dados de estudo (banco de leitura): copiar e compartilhar não dependem dos dados de estudo.
// Cada frente da 1A acrescenta as suas ações aqui, na ordem Estudar · Grifar · Nota · Copiar · Compartilhar.
import type { Vid } from '@sensus/core';
import type { SelectionAction } from '@/features/common/SelectionBar';
import { SHARE, useShare } from '@/features/share';
import { useStudy } from '@/state/study';

export function useSelectionActions(range: { start: Vid; end: Vid }, opts: { study: boolean }): SelectionAction[] {
  const textSource = useStudy((s) => s.textSource);
  const openShare = (intent: 'copy' | 'share') =>
    useShare.getState().open({ kind: 'verses', start: range.start, end: range.end, source: textSource, intent });
  return [
    ...(opts.study
      ? [{ key: 'study', label: SHARE.study, icon: 'study', primary: true, onPress: () => useStudy.getState().setDetent('half') } satisfies SelectionAction]
      : []),
    { key: 'copy', label: SHARE.copy, icon: 'copy', onPress: () => openShare('copy') },
    { key: 'share', label: SHARE.share, icon: 'share', onPress: () => openShare('share') },
  ];
}
