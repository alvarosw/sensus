// Japonês de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).

export const jaShare = {
  barLabel: '選択範囲の操作',
  study: '学ぶ',
  copy: 'コピー',
  share: '共有',
  shareMore: '共有…',
  copyTitle: '箇所をコピー',
  shareTitle: '箇所を共有',
  synthTitle: 'まとめを共有',
  shareSynth: 'まとめを共有',
  close: '閉じる',
  verseNumbers: '節番号',
  plainText: 'プレーンテキスト',
  previewLabel: '共有されるテキスト',
  chars: (_n: number, shown: string) => `${shown}文字`,
  loading: '本文を読み込み中…',
  loadError: '本文を読み込めませんでした。',
  copied: (what: string) => `コピーしました · ${what}`,
  synthOf: (ref: string) => `${ref} のまとめ`,
  copyFailed: 'コピーできませんでした。',
  shareFailed: '共有を開けませんでした。',
  sources: '出典',
  inference: '（推論）',
  aiFooter: '上記の出典をもとに AI が作成した要約です。',
  via: 'Sensus より',
};
