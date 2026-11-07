// Vietnamita de app/src/features/maps/strings.ts. A revisar por falante nativo. As atribuições (MAP_ATTRIBUTIONS) ficam em pt, como licença.
import type { ConfidenceBand } from '@sensus/core';

export const viMaps = {
  title: 'Bản đồ',
  loading: 'Đang tải bản đồ…',
  loadError: 'Không thể tải bản đồ. Hãy kiểm tra kết nối.',
  noPlaces: 'Không có địa danh nào có tọa độ trong phân đoạn này.',
  scopeSelection: 'Lựa chọn',
  scopeUnit: 'Phân đoạn',
  scopeBook: 'Sách',
  placesCount: (n: number) => (n === 1 ? '1 địa danh' : `${n} địa danh`),
  passageTitle: 'Địa danh trong đoạn',
  openMap: 'Xem trên bản đồ',
  fit: 'Vừa khung',
  legendTitle: 'Độ tin cậy của việc xác định',
  bands: { high: 'cao', mid: 'trung bình', low: 'thấp', none: 'chưa đánh giá' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0.8', mid: '0.5–0.8', low: '< 0.5', none: 'nguồn không đánh giá' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: 'Độ tin cậy',
  identification: 'Xác định',
  coords: 'Tọa độ',
  openPlace: 'Mở địa danh',
  passages: 'Phân đoạn',
  candidates: 'Các xác định hiện đại khác',
  homonyms: 'Địa danh khác trùng tên',
  sourcesOf: 'Nguồn',
  selectedHint: 'Chạm vào một điểm đánh dấu để xem địa danh.',
  close: 'Đóng',
  place: 'Địa danh',
  placeHint: 'Chạm vào một điểm đánh dấu để xem địa danh, cách xác định và các phân đoạn.',
};
