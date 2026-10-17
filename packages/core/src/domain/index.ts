// Domínio puro do Sensus: língua, testamento, Strong, léxico, morfologia, vid, escrita e fatos da palavra.
// Só importa de ../types e ../refs. Ver docs/ARCHITECTURE.md §2.
export * from './language';
export * from './strong';
export * from './lexicon';
export {
  GREEK_FUNCTION_POS,
  SEMITIC_FUNCTION_POS,
  mainSegmentOf,
  isVerbToken,
  isProperNameToken,
  // "isContentToken" já é exportado pelo núcleo (src/morph.ts); aqui o nome explícito evita a colisão.
  isContentToken as isContentTokenByLang,
} from './morph';
export * from './vid';
export * from './script';
export * from './word';
