// Hindi de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).

export const hiShare = {
  barLabel: 'चयन की क्रियाएँ',
  study: 'अध्ययन',
  copy: 'कॉपी करें',
  share: 'साझा करें',
  shareMore: 'साझा करें…',
  copyTitle: 'अंश कॉपी करें',
  shareTitle: 'अंश साझा करें',
  synthTitle: 'सारांश साझा करें',
  shareSynth: 'सारांश साझा करें',
  close: 'बंद करें',
  verseNumbers: 'पद संख्या',
  plainText: 'सादा पाठ',
  previewLabel: 'साझा होने वाला पाठ',
  chars: (_n: number, shown: string) => `${shown} अक्षर`,
  loading: 'पाठ लोड हो रहा है…',
  loadError: 'पाठ लोड नहीं हो सका।',
  copied: (what: string) => `कॉपी किया गया · ${what}`,
  synthOf: (ref: string) => `${ref} का सारांश`,
  copyFailed: 'कॉपी नहीं हो सका।',
  shareFailed: 'साझा करना नहीं खुल सका।',
  sources: 'स्रोत',
  inference: '(अनुमान)',
  aiFooter: 'ऊपर दिए स्रोतों से AI द्वारा बनाया गया सारांश।',
  via: 'Sensus से',
};
