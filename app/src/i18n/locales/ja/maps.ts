// Japonês de app/src/features/maps/strings.ts. A revisar por falante nativo. As atribuições (MAP_ATTRIBUTIONS) ficam em pt, como licença.
import type { ConfidenceBand } from '@sensus/core';

export const jaMaps = {
  title: '地図',
  loading: '地図を読み込み中…',
  loadError: '地図を読み込めませんでした。接続を確認してください。',
  noPlaces: 'この箇所には座標のある地名がありません。',
  scopeSelection: '選択範囲',
  scopeUnit: 'ペリコペ',
  scopeBook: '書',
  placesCount: (n: number) => `${n} 件の地名`,
  passageTitle: '箇所の地名',
  openMap: '地図で見る',
  fit: '全体表示',
  legendTitle: '同定の確からしさ',
  bands: { high: '高', mid: '中', low: '低', none: '未評価' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0.8', mid: '0.5–0.8', low: '< 0.5', none: '資料では評価されていません' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: '確からしさ',
  identification: '同定',
  coords: '座標',
  openPlace: '地名を開く',
  passages: '箇所',
  candidates: 'その他の現代の同定',
  homonyms: 'この名前の他の地名',
  sourcesOf: '資料',
  selectedHint: 'マーカーをタップすると地名が表示されます。',
  close: '閉じる',
  place: '地名',
  placeHint: 'マーカーをタップすると、地名・同定・関連箇所が表示されます。',
};
