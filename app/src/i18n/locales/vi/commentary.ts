// Vietnamita de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
export const viCommentary = {
  rowTitle: 'Giải nghĩa và chú giải',
  title: 'Giải nghĩa và chú giải',
  help: 'Chọn các truyền thống bạn muốn thấy trong khi học: lăng kính, chú giải và những gì AI sử dụng. Các truyền thống khác sẽ được ẩn trong toàn ứng dụng.',
  allTraditions: 'Tất cả truyền thống',
  secTraditions: 'Truyền thống',
  secSources: 'Nguồn chú giải',
  sourcesHelp: 'Mỗi nguồn có thể được ẩn ngay cả khi truyền thống của nó được chấp nhận.',
  noSources: 'Cơ sở dữ liệu này không có chú giải.',
  hiddenNotice: 'Chú giải từ các truyền thống khác đang bị ẩn theo tùy chọn của bạn',
  adjust: 'Điều chỉnh',
  // Resumo da preferência (linha de Configurações). Os rótulos das tradições vêm do núcleo (traditionLabel).
  onlyTradition: (a: string) => `Chỉ ${a}`,
  twoTraditions: (a: string, b: string) => `${a} và ${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a}, ${b} và ${more} khác`,
  hiddenSources: (n: number) => `${n} nguồn bị ẩn`,
};
