// Francês de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).

export const frShare = {
  barLabel: 'Actions de la sélection',
  study: 'Étudier',
  copy: 'Copier',
  share: 'Partager',
  shareMore: 'Partager…',
  copyTitle: 'Copier le passage',
  shareTitle: 'Partager le passage',
  synthTitle: 'Partager la synthèse',
  shareSynth: 'Partager la synthèse',
  close: 'Fermer',
  verseNumbers: 'Numéros des versets',
  plainText: 'Texte brut',
  previewLabel: 'Texte qui sera partagé',
  chars: (n: number, shown: string) => `${shown} ${n <= 1 ? 'caractère' : 'caractères'}`,
  loading: 'Chargement du texte…',
  loadError: 'Impossible de charger le texte.',
  copied: (what: string) => `Copié · ${what}`,
  synthOf: (ref: string) => `synthèse de ${ref}`,
  copyFailed: 'Impossible de copier.',
  shareFailed: 'Impossible d’ouvrir le partage.',
  sources: 'Sources',
  inference: '(Inférence)',
  aiFooter: 'Résumé généré par IA à partir des sources ci-dessus.',
  via: 'via Sensus',
};
