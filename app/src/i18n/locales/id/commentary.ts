// Indonésio de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
export const idCommentary = {
  rowTitle: 'Tafsiran dan komentar',
  title: 'Tafsiran dan komentar',
  help: 'Pilih tradisi yang ingin Anda lihat dalam studi: lensa, komentar, dan yang digunakan AI. Sisanya disembunyikan di seluruh aplikasi.',
  allTraditions: 'Semua tradisi',
  secTraditions: 'Tradisi',
  secSources: 'Sumber komentar',
  sourcesHelp: 'Setiap sumber dapat disembunyikan meskipun tradisinya diterima.',
  noSources: 'Basis data ini tidak memiliki komentar.',
  hiddenNotice: 'Komentar dari tradisi lain disembunyikan oleh preferensi Anda',
  adjust: 'Sesuaikan',
  // Resumo da preferência (linha de Configurações). Os rótulos das tradições vêm do núcleo (traditionLabel).
  onlyTradition: (a: string) => `Hanya ${a}`,
  twoTraditions: (a: string, b: string) => `${a} dan ${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a}, ${b} dan ${more} lainnya`,
  hiddenSources: (n: number) => `${n} sumber disembunyikan`,
};
