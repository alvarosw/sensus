// Ações Grifar e Nota da barra de seleção, no formato do contrato da barra comum (features/common/SelectionBar).
// Grifar mostra o ponto com a cor que a seleção já tem (quando todo o trecho tem o mesmo grifo); Nota fica cheia
// quando já existe nota exatamente neste trecho.
import { useMarksStore, noteOn, uniformColor } from '@/user-data';
import { HIGHLIGHT_TINTS } from '@/design';
import { useTheme, type IconName } from '@/design';
import { useMarksUi } from './marks-ui';
import { MARKS } from './strings';

export interface MarkSelectionAction {
  key: 'grifar' | 'nota';
  label: string;
  icon: IconName;
  onPress(): void;
  dotColor?: string;
  filled?: boolean;
}

export function useMarkSelectionActions(start: number, end: number, onGrifar: () => void): { grifar: MarkSelectionAction; nota: MarkSelectionAction } {
  const { scheme } = useTheme();
  const marks = useMarksStore((s) => s.marks);
  const color = uniformColor(marks.filter((m) => m.color !== null), start, end);
  const hasNote = noteOn(marks.filter((m) => m.note !== null), start, end) !== null;
  return {
    grifar: {
      key: 'grifar',
      label: MARKS.highlight,
      icon: 'highlight',
      onPress: onGrifar,
      dotColor: color ? HIGHLIGHT_TINTS[scheme][color].dot : undefined,
    },
    nota: {
      key: 'nota',
      label: MARKS.note,
      icon: 'note',
      onPress: () => useMarksUi.getState().openNote(start, end),
      filled: hasNote,
    },
  };
}
