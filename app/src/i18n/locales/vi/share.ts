// Vietnamita de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).

export const viShare = {
  barLabel: 'Thao tác với phần chọn',
  study: 'Học',
  copy: 'Sao chép',
  share: 'Chia sẻ',
  shareMore: 'Chia sẻ…',
  copyTitle: 'Sao chép đoạn',
  shareTitle: 'Chia sẻ đoạn',
  synthTitle: 'Chia sẻ tóm lược',
  shareSynth: 'Chia sẻ tóm lược',
  close: 'Đóng',
  verseNumbers: 'Số câu',
  plainText: 'Văn bản thường',
  previewLabel: 'Văn bản sẽ được chia sẻ',
  chars: (_n: number, shown: string) => `${shown} ký tự`,
  loading: 'Đang tải văn bản…',
  loadError: 'Không tải được văn bản.',
  copied: (what: string) => `Đã sao chép · ${what}`,
  synthOf: (ref: string) => `tóm lược ${ref}`,
  copyFailed: 'Không sao chép được.',
  shareFailed: 'Không mở được chia sẻ.',
  sources: 'Nguồn',
  inference: '(Suy luận)',
  aiFooter: 'Tóm lược do AI tạo từ các nguồn ở trên.',
  via: 'qua Sensus',
};
