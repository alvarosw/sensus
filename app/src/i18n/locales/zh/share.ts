// Chinês de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).

export const zhShare = {
  barLabel: '所选内容操作',
  study: '研读',
  copy: '复制',
  share: '分享',
  shareMore: '分享…',
  copyTitle: '复制经文',
  shareTitle: '分享经文',
  synthTitle: '分享综述',
  shareSynth: '分享综述',
  close: '关闭',
  verseNumbers: '节号',
  plainText: '纯文本',
  previewLabel: '将要分享的文字',
  chars: (_n: number, shown: string) => `${shown} 个字符`,
  loading: '正在加载经文…',
  loadError: '无法加载经文。',
  copied: (what: string) => `已复制 · ${what}`,
  synthOf: (ref: string) => `${ref} 的综述`,
  copyFailed: '无法复制。',
  shareFailed: '无法打开分享。',
  sources: '来源',
  inference: '（推论）',
  aiFooter: '由 AI 根据以上来源生成的摘要。',
  via: '来自 Sensus',
};
