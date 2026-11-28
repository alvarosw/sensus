// Alemão de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).

export const deShare = {
  barLabel: 'Aktionen für die Auswahl',
  study: 'Studieren',
  copy: 'Kopieren',
  share: 'Teilen',
  shareMore: 'Teilen…',
  copyTitle: 'Abschnitt kopieren',
  shareTitle: 'Abschnitt teilen',
  synthTitle: 'Zusammenfassung teilen',
  shareSynth: 'Zusammenfassung teilen',
  close: 'Schließen',
  verseNumbers: 'Versnummern',
  plainText: 'Reiner Text',
  previewLabel: 'Text, der geteilt wird',
  chars: (_n: number, shown: string) => `${shown} Zeichen`,
  loading: 'Text wird geladen…',
  loadError: 'Der Text konnte nicht geladen werden.',
  copied: (what: string) => `Kopiert · ${what}`,
  synthOf: (ref: string) => `Zusammenfassung von ${ref}`,
  copyFailed: 'Kopieren nicht möglich.',
  shareFailed: 'Teilen konnte nicht geöffnet werden.',
  sources: 'Quellen',
  inference: '(Folgerung)',
  aiFooter: 'Von KI aus den obigen Quellen erstellte Zusammenfassung.',
  via: 'über Sensus',
};
