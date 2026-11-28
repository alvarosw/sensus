// Espanhol de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).

export const esShare = {
  barLabel: 'Acciones de la selección',
  study: 'Estudiar',
  copy: 'Copiar',
  share: 'Compartir',
  shareMore: 'Compartir…',
  copyTitle: 'Copiar pasaje',
  shareTitle: 'Compartir pasaje',
  synthTitle: 'Compartir síntesis',
  shareSynth: 'Compartir síntesis',
  close: 'Cerrar',
  verseNumbers: 'Números de versículo',
  plainText: 'Texto simple',
  previewLabel: 'Texto que se enviará',
  chars: (n: number, shown: string) => `${shown} ${n === 1 ? 'carácter' : 'caracteres'}`,
  loading: 'Cargando el texto…',
  loadError: 'No se pudo cargar el texto.',
  copied: (what: string) => `Copiado · ${what}`,
  synthOf: (ref: string) => `síntesis de ${ref}`,
  copyFailed: 'No se pudo copiar.',
  shareFailed: 'No se pudo abrir el menú de compartir.',
  sources: 'Fuentes',
  inference: '(Inferencia)',
  aiFooter: 'Resumen generado por IA a partir de las fuentes anteriores.',
  via: 'vía Sensus',
};
