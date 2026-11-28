// Urdu de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).

export const urShare = {
  barLabel: 'انتخاب کے اقدامات',
  study: 'مطالعہ',
  copy: 'کاپی کریں',
  share: 'شیئر کریں',
  shareMore: 'شیئر کریں…',
  copyTitle: 'حصہ کاپی کریں',
  shareTitle: 'حصہ شیئر کریں',
  synthTitle: 'خلاصہ شیئر کریں',
  shareSynth: 'خلاصہ شیئر کریں',
  close: 'بند کریں',
  verseNumbers: 'آیت نمبر',
  plainText: 'سادہ متن',
  previewLabel: 'شیئر ہونے والا متن',
  chars: (_n: number, shown: string) => `${shown} حروف`,
  loading: 'متن لوڈ ہو رہا ہے…',
  loadError: 'متن لوڈ نہیں ہو سکا۔',
  copied: (what: string) => `کاپی ہو گیا · ${what}`,
  synthOf: (ref: string) => `${ref} کا خلاصہ`,
  copyFailed: 'کاپی نہیں ہو سکا۔',
  shareFailed: 'شیئر نہیں کھل سکا۔',
  sources: 'ماخذ',
  inference: '(استنباط)',
  aiFooter: 'اوپر دیے گئے ماخذ سے AI کا تیار کردہ خلاصہ۔',
  via: 'Sensus سے',
};
