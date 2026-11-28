// API pública da camada de dados do usuário (banco no aparelho). Features importam daqui, não dos arquivos internos.
export { openUserDb, USER_DB_NAME } from './user-db';
export { useMarksStore, type MarksState } from './marks-store';
export {
  MARK_COLORS,
  colorAt,
  countByBook,
  filterMarks,
  isHighlight,
  isNote,
  noteOn,
  notesEndingAt,
  overlaps,
  sortMarks,
  uniformColor,
  type Mark,
  type MarkChange,
  type MarkColor,
  type MarkFilter,
  type MarkKind,
  type MarkOrder,
} from './marks-model';
