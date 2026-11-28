// Estado de tela das marcas: qual nota está aberta na folha e se está em edição. Os dados ficam em user-data.
import { create } from 'zustand';
import { useMarksStore } from '@/user-data';

export interface NoteView {
  start: number;
  end: number;
  /** Editor aberto (Nota ou Editar). Falso: leitura, com Editar e Apagar (toque no marcador). */
  editing: boolean;
}

interface MarksUi {
  note: NoteView | null;
  /** Nota do trecho para editar (botão Nota da barra). */
  openNote(start: number, end: number): void;
  /** Toque no marcador: abre a nota que termina nesse versículo, para ler. */
  viewNoteEndingAt(vid: number): void;
  setEditing(editing: boolean): void;
  closeNote(): void;
}

export const useMarksUi = create<MarksUi>()((set) => ({
  note: null,
  openNote: (start, end) => set({ note: { start, end, editing: true } }),
  viewNoteEndingAt: (vid) => {
    const n = useMarksStore.getState().marks.find((m) => m.note !== null && m.endVid === vid);
    if (n) set({ note: { start: n.startVid, end: n.endVid, editing: false } });
  },
  setEditing: (editing) => set((s) => (s.note ? { note: { ...s.note, editing } } : {})),
  closeNote: () => set({ note: null }),
}));
