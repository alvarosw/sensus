// Vietnamita de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';

export const viStudy = {
  sheet: 'Nghiên cứu phân đoạn đã chọn',
  expand: 'Mở rộng nghiên cứu',
  collapse: 'Thu gọn nghiên cứu',
  close: 'Xóa lựa chọn',
  verseCount: (n: number) => `${n} câu`,
  versesAbbr: (n: number) => `${n} câu`,
  crosses: (a: string, b: string) => `trải qua ${a} → ${b}`,
  pericope: (r: string) => `Phân đoạn ${r}`,
  pericopeWhole: 'Toàn bộ phân đoạn',
  pericopeExpanded: (r: string) => `Đã mở rộng lựa chọn tới phân đoạn ${r}`,
  railLabel: 'Lăng kính nghiên cứu',

  factComentaristas: 'chú giải',
  factVariantes: (n: number, slash: string) => `dị bản ${slash}`,
  variantCount: (n: number) => `${n} dị bản`,
  factXrefs: 'tham chiếu chéo',
  factHapax: (t: Testament) => `hapax trong ${testamentLabel(t, 'vi')}`,
  /** Contagem de versículos no testamento da palavra; 1 vira "versículo", o resto "vv.". */
  factVv: (n: number, t: Testament) => `${n} câu trong ${testamentLabel(t, 'vi')}`,
  factNoData: 'Không có dữ liệu',

  deepen: 'Đi sâu',
  seeAll: 'Xem tất cả',
  seeLess: 'Thu gọn',
  deepened: 'Đã đi sâu',
  deepenPoint: 'Đi sâu điểm này',
  whereFrom: 'Điều này đến từ đâu?',
  askAbout: 'Hỏi về điều này',
  openPreview: 'Mở xem trước',

  summaryOfUnit: 'Tóm tắt phân đoạn',
  summaryContains: 'chứa lựa chọn',
  noSummary: 'Không có tóm tắt cho mục này.',
  thinking: 'đang suy nghĩ…',
  noProvider:
    'Không có phương thức AI nào khả dụng. Đăng nhập bằng ChatGPT hoặc thêm khóa API trong cài đặt để xem tóm tắt theo từng lăng kính.',
  configure: 'Thiết lập AI',
  summaryError: (m: string) => `Không thể tạo tóm tắt: ${m}`,
  retry: 'Thử lại',
  panelError: 'Không thể tải nguồn cho phân đoạn này.',
  loadingSources: 'Đang tải nguồn…',

  lensCount: {
    visao: 'AI · trích dẫn các nguồn bên dưới',
    aplicacao: 'không có nguồn riêng',
  },

  // Visão geral (o fio)
  threadTitle: 'Mạch của phân đoạn này',
  stepsCount: (n: number) => `${n} bước`,
  andMore: (n: number) => `và ${n} nữa`,

  // Texto
  translations: 'Bản dịch và nguyên văn',
  cmpBlivre: 'Bíblia Livre',
  cmpKjv: 'KJV',
  cmpOriginal: 'Nguyên văn',
  originalHint: (nt: string, at: string) =>
    `Nguyên văn: ${nt} cho Tân Ước, ${at} cho Cựu Ước. Chạm vào một từ để xem hình thái học.`,
  variantsTitle: 'Dị bản giữa các ấn bản',
  variantsEmpty: (list: string) => `Không có khác biệt giữa ${list} trong các câu này.`,
  variantType: 'Dị bản',
  omits: 'lược bỏ',
  analyzeWord: 'Phân tích từ',
  ask: 'Hỏi',

  // Literário
  neighborhood: 'Ngữ cảnh xung quanh',
  include: 'bao gồm',
  divisions: 'Phân chia văn bản',
  division: 'Phân chia',
  paragraphStart: 'Bắt đầu đoạn',
  heading: 'Tiêu đề',
  bookIntro: 'Giới thiệu sách',
  readEntry: 'Đọc mục',
  entry: 'Mục',
  topicIndex: 'Mục lục chủ đề',

  // Histórico
  place: 'Địa danh',
  placesHeading: (_n: number) => 'Địa điểm',
  placesAndEntries: (places: number, entries: number) => `${places} địa điểm · ${entries} mục`,
  peopleGroups: 'Người và nhóm người',
  dictionaries: 'Từ điển và bách khoa',
  seeEntity: 'Xem thực thể',
  otherPassages: 'Phân đoạn khác',
  otherPassagesSoon: 'Danh sách phân đoạn nhắc tới thực thể này sẽ sớm có.',
  entityType: { person: 'Người', place: 'Địa danh', event: 'Sự kiện', group: 'Nhóm', other: 'Thực thể' } as Record<
    string,
    string
  >,
  historicalEmpty: 'Không có địa danh, người hoặc mục nào liên quan đến các câu này.',
  timeline: 'Dòng thời gian',
  timelineHere: 'trong phân đoạn này',
  timelineOpen: 'Mở trên dòng thời gian',

  // Língua
  word: 'Từ',
  hapax: 'hapax',
  commentMentions: (n: number) => `được trích trong ${n} chú giải`,
  lexiconConcordance: 'Từ điển và thư mục từ',
  languageEmpty: 'Không có từ nào của nguyên văn cho các câu này.',
  inText: 'trong văn bản',

  // Intertexto
  xrefType: 'Tham chiếu',
  from: 'từ',
  pinSideBySide: 'Ghim cạnh nhau',
  pinned: (r: string) => `${r} được ghim phía trên văn bản`,
  topics: 'Mục lục chủ đề',
  xrefsEmpty: 'Không có tham chiếu chéo cho các câu này.',
  relevance: 'Mức liên quan',

  // Interpretação
  whoComments: 'Ai chú giải từng câu',
  allTraditions: 'Tất cả',
  commentary: 'Chú giải',
  readFull: 'Đọc toàn văn',
  moreByAuthor: 'Thêm của tác giả này',
  onlyAuthor: (a: string) => `Chỉ ${a}`,
  clearAuthor: 'Tất cả tác giả',
  commentsEmpty: 'Không có chú giải cho các câu này.',
  patristic: 'Giáo phụ',
  matrixLabel: 'Ai chú giải từng câu',

  // Aplicação
  applicationHint: 'Phần ứng dụng chỉ đến từ AI và luôn được đánh dấu là suy luận.',
  xrefsCount: (n: number) => `${n} tham chiếu chéo`,
  commentariesCount: (n: number) => `${n} chú giải`,
  chapterMark: (n: number) => `(chương ${n})`,
  literaryEmpty: 'Nguồn này không có ngữ cảnh văn học.',
  sheetBackHalf: 'Quay lại chiều cao một nửa',
  sheetToggleHeight: 'Đổi chiều cao phần nghiên cứu',
};
