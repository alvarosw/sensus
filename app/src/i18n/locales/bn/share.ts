// Bengali de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).

export const bnShare = {
  barLabel: 'নির্বাচনের কাজ',
  study: 'অধ্যয়ন',
  copy: 'কপি করুন',
  share: 'শেয়ার করুন',
  shareMore: 'শেয়ার করুন…',
  copyTitle: 'অংশ কপি করুন',
  shareTitle: 'অংশ শেয়ার করুন',
  synthTitle: 'সারাংশ শেয়ার করুন',
  shareSynth: 'সারাংশ শেয়ার করুন',
  close: 'বন্ধ করুন',
  verseNumbers: 'পদ নম্বর',
  plainText: 'সাধারণ লেখা',
  previewLabel: 'যে লেখা শেয়ার হবে',
  chars: (_n: number, shown: string) => `${shown}টি অক্ষর`,
  loading: 'লেখা লোড হচ্ছে…',
  loadError: 'লেখা লোড করা যায়নি।',
  copied: (what: string) => `কপি হয়েছে · ${what}`,
  synthOf: (ref: string) => `${ref}-এর সারাংশ`,
  copyFailed: 'কপি করা যায়নি।',
  shareFailed: 'শেয়ার খোলা যায়নি।',
  sources: 'উৎস',
  inference: '(অনুমান)',
  aiFooter: 'উপরের উৎসগুলো থেকে AI-তৈরি সারাংশ।',
  via: 'Sensus থেকে',
};
