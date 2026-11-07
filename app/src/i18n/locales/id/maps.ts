// Indonésio de app/src/features/maps/strings.ts. A revisar por falante nativo. As atribuições (MAP_ATTRIBUTIONS) ficam em pt, como licença.
import type { ConfidenceBand } from '@sensus/core';

export const idMaps = {
  title: 'Peta',
  loading: 'Memuat peta…',
  loadError: 'Peta tidak dapat dimuat. Periksa koneksi Anda.',
  noPlaces: 'Tidak ada tempat dengan koordinat di perikop ini.',
  scopeSelection: 'Pilihan',
  scopeUnit: 'Perikop',
  scopeBook: 'Kitab',
  placesCount: (n: number) => (n === 1 ? '1 tempat' : `${n} tempat`),
  passageTitle: 'Tempat dalam perikop',
  openMap: 'Lihat di peta',
  fit: 'Sesuaikan',
  legendTitle: 'Keyakinan identifikasi',
  bands: { high: 'tinggi', mid: 'sedang', low: 'rendah', none: 'belum dinilai' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0.8', mid: '0.5–0.8', low: '< 0.5', none: 'sumber tidak menilai' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: 'Keyakinan',
  identification: 'Identifikasi',
  coords: 'Koordinat',
  openPlace: 'Buka tempat',
  passages: 'Perikop',
  candidates: 'Identifikasi modern lainnya',
  homonyms: 'Tempat lain dengan nama ini',
  sourcesOf: 'Sumber',
  selectedHint: 'Ketuk penanda untuk melihat tempatnya.',
  close: 'Tutup',
  place: 'Tempat',
  placeHint: 'Ketuk penanda untuk melihat tempat, identifikasinya, dan perikopnya.',
};
