// Indonésio de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';

export const idStudy = {
  sheet: 'Studi perikop yang dipilih',
  expand: 'Perluas studi',
  collapse: 'Ciutkan studi',
  close: 'Hapus pilihan',
  verse: 'ayat',
  verses: 'ayat',
  crosses: (a: string, b: string) => `melintasi ${a} → ${b}`,
  pericope: (r: string) => `Perikop ${r}`,
  pericopeWhole: 'Seluruh perikop',
  pericopeExpanded: (r: string) => `Pilihan diperluas ke perikop ${r}`,
  railLabel: 'Lensa studi',

  factComentaristas: 'pemberi komentar',
  factVariante: (slash: string) => `varian ${slash}`,
  factVariantes: (slash: string) => `varian ${slash}`,
  factXrefs: 'ref. silang',
  factHapax: (t: Testament) => `hapax di ${testamentLabel(t, 'id')}`,
  /** Contagem de versículos no testamento da palavra; 1 vira "versículo", o resto "vv.". */
  factVv: (n: number, t: Testament) => `${n} ayat di ${testamentLabel(t, 'id')}`,
  factNoData: 'Tidak ada data',

  deepen: 'Perdalam',
  seeAll: 'Lihat semua',
  seeLess: 'Lebih sedikit',
  deepened: 'Diperdalam',
  deepenPoint: 'Perdalam poin ini',
  whereFrom: 'Dari mana ini berasal?',
  askAbout: 'Tanyakan tentang ini',
  openPreview: 'Buka pratinjau',

  summaryOfUnit: 'Ringkasan perikop',
  summaryContains: 'yang memuat pilihan',
  noSummary: 'Tidak ada ringkasan untuk bagian ini.',
  thinking: 'sedang berpikir…',
  noProvider:
    'Tidak ada metode AI yang tersedia. Masuk dengan ChatGPT atau tambahkan kunci API di pengaturan untuk melihat ringkasan per lensa.',
  configure: 'Atur AI',
  summaryError: (m: string) => `Ringkasan tidak dapat dibuat: ${m}`,
  retry: 'Coba lagi',
  panelError: 'Sumber untuk perikop ini tidak dapat dimuat.',
  loadingSources: 'Memuat sumber…',

  lensCount: {
    visao: 'AI · mengutip sumber di bawah',
    aplicacao: 'tanpa sumber sendiri',
  },

  // Visão geral (o fio)
  threadTitle: 'Alur perikop ini',
  stepsCount: (n: number) => `${n} langkah`,
  andMore: (n: number) => `dan ${n} lagi`,

  // Texto
  translations: 'Terjemahan dan teks asli',
  cmpBlivre: 'Bíblia Livre',
  cmpKjv: 'KJV',
  cmpOriginal: 'Asli',
  originalHint: (nt: string, at: string) =>
    `Asli: ${nt} untuk PB, ${at} untuk PL. Ketuk sebuah kata untuk melihat morfologinya.`,
  variantsTitle: 'Varian antar edisi',
  variantsEmpty: (list: string) => `Tidak ada perbedaan antara ${list} di ayat-ayat ini.`,
  variantType: 'Varian',
  omits: 'menghilangkan',
  analyzeWord: 'Analisis kata',
  ask: 'Tanya',

  // Literário
  neighborhood: 'Konteks sekitar',
  include: 'sertakan',
  divisions: 'Pembagian teks',
  division: 'Pembagian',
  paragraphStart: 'Awal paragraf',
  heading: 'Judul',
  bookIntro: 'Pengantar kitab',
  readEntry: 'Baca entri',
  entry: 'Entri',
  topicIndex: 'Indeks topik',

  // Histórico
  place: 'Tempat',
  places: 'Tempat-tempat',
  peopleGroups: 'Orang dan kelompok',
  dictionaries: 'Kamus dan ensiklopedia',
  seeEntity: 'Lihat entitas',
  otherPassages: 'Perikop lain',
  otherPassagesSoon: 'Daftar perikop yang menyebut entitas ini segera tersedia.',
  entityType: { person: 'Orang', place: 'Tempat', event: 'Peristiwa', group: 'Kelompok', other: 'Entitas' } as Record<
    string,
    string
  >,
  historicalEmpty: 'Tidak ada tempat, orang, atau entri yang terkait dengan ayat-ayat ini.',
  timeline: 'Lini masa',
  timelineHere: 'dalam perikop ini',
  timelineOpen: 'Buka di lini masa',

  // Língua
  word: 'Kata',
  hapax: 'hapax',
  commentMentions: (n: number) => `dikutip dalam ${n} komentar`,
  lexiconConcordance: 'Leksikon dan konkordansi',
  languageEmpty: 'Tidak ada kata dari teks asli untuk ayat-ayat ini.',
  inText: 'dalam teks',

  // Intertexto
  xrefType: 'Ref.',
  from: 'dari',
  pinSideBySide: 'Sematkan berdampingan',
  pinned: (r: string) => `${r} disematkan di atas teks`,
  topics: 'Indeks topik',
  xrefsEmpty: 'Tidak ada referensi silang untuk ayat-ayat ini.',
  relevance: 'Relevansi',

  // Interpretação
  whoComments: 'Siapa yang mengomentari setiap ayat',
  allTraditions: 'Semua',
  commentary: 'Komentar',
  readFull: 'Baca selengkapnya',
  moreByAuthor: 'Lainnya dari penulis ini',
  onlyAuthor: (a: string) => `Hanya ${a}`,
  clearAuthor: 'Semua penulis',
  commentsEmpty: 'Tidak ada komentar untuk ayat-ayat ini.',
  patristic: 'Patristik',
  matrixLabel: 'Siapa yang mengomentari setiap ayat',

  // Aplicação
  applicationHint: 'Aplikasi hanya berasal dari AI dan selalu ditandai sebagai inferensi.',
};
