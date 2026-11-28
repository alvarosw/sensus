// Ações das marcas com aviso e Desfazer. Quem chama (barra de seleção, folha de nota, lista) só diz o que fazer.
import { formatReference, BOOK_TABLE, type Vid } from '@sensus/core';
import { t } from '@/i18n';
import { currentLang } from '@/i18n/lang-store';
import { useStudy } from '@/state/study';
import { useMarksStore, type Mark, type MarkColor } from '@/user-data';
import { MARKS } from './strings';

const refOf = (start: Vid, end: Vid) => formatReference({ start, end }, BOOK_TABLE, currentLang());

/** Mostra o aviso com Desfazer (o mesmo Toast do leitor). */
function undoable(text: string): void {
  useStudy.getState().showToast({ text, actionLabel: MARKS.undo, onAction: () => void undoLast() });
}

export async function undoLast(): Promise<void> {
  try {
    await useMarksStore.getState().undo();
  } finally {
    useStudy.getState().showToast(null);
  }
}

/** Grifa o trecho com a cor e avisa "Grifado em …". */
export async function highlight(start: Vid, end: Vid, color: MarkColor): Promise<void> {
  try {
    await useMarksStore.getState().paint(start, end, color);
    undoable(MARKS.highlighted(MARKS.colorNames[color], refOf(start, end)));
  } catch {
    useStudy.getState().showToast({ text: t('common.error') });
  }
}

/** Tira o grifo do trecho, com aviso e Desfazer. */
export async function removeHighlight(start: Vid, end: Vid): Promise<void> {
  try {
    await useMarksStore.getState().paint(start, end, null);
    undoable(MARKS.highlightRemoved(refOf(start, end)));
  } catch {
    useStudy.getState().showToast({ text: t('common.error') });
  }
}

/** Salva a nota (texto vazio apaga). Apagar oferece Desfazer. */
export async function saveNote(start: Vid, end: Vid, text: string, existing?: Mark): Promise<void> {
  try {
    const change = await useMarksStore.getState().saveNote(start, end, text, existing);
    if (change && change.added.length === 0) undoable(MARKS.noteDeleted);
  } catch {
    useStudy.getState().showToast({ text: t('common.error') });
  }
}

/** Apaga marcas sem diálogo: o aviso oferece Desfazer. */
export async function deleteMarks(marks: readonly Mark[], text: string = MARKS.markDeleted): Promise<void> {
  try {
    await useMarksStore.getState().remove(marks);
    undoable(text);
  } catch {
    useStudy.getState().showToast({ text: t('common.error') });
  }
}

/** Muda a cor de um grifo. */
export async function changeColor(mark: Mark, color: MarkColor): Promise<void> {
  try {
    await useMarksStore.getState().setColor(mark, color);
  } catch {
    useStudy.getState().showToast({ text: t('common.error') });
  }
}
