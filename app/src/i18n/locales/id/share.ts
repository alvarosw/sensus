// Indonésio de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).

export const idShare = {
  barLabel: 'Tindakan pilihan',
  study: 'Pelajari',
  copy: 'Salin',
  share: 'Bagikan',
  shareMore: 'Bagikan…',
  copyTitle: 'Salin perikop',
  shareTitle: 'Bagikan perikop',
  synthTitle: 'Bagikan ringkasan',
  shareSynth: 'Bagikan ringkasan',
  close: 'Tutup',
  verseNumbers: 'Nomor ayat',
  plainText: 'Teks biasa',
  previewLabel: 'Teks yang akan dibagikan',
  chars: (_n: number, shown: string) => `${shown} karakter`,
  loading: 'Memuat teks…',
  loadError: 'Teks tidak dapat dimuat.',
  copied: (what: string) => `Disalin · ${what}`,
  synthOf: (ref: string) => `ringkasan ${ref}`,
  copyFailed: 'Tidak dapat menyalin.',
  shareFailed: 'Tidak dapat membuka berbagi.',
  sources: 'Sumber',
  inference: '(Inferensi)',
  aiFooter: 'Ringkasan dibuat oleh AI dari sumber di atas.',
  via: 'lewat Sensus',
};
