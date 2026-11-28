// Russo de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).
import { ruPlural } from '../../plural';

export const ruShare = {
  barLabel: 'Действия с выделением',
  study: 'Изучать',
  copy: 'Копировать',
  share: 'Поделиться',
  shareMore: 'Поделиться…',
  copyTitle: 'Копировать отрывок',
  shareTitle: 'Поделиться отрывком',
  synthTitle: 'Поделиться обзором',
  shareSynth: 'Поделиться обзором',
  close: 'Закрыть',
  verseNumbers: 'Номера стихов',
  plainText: 'Простой текст',
  previewLabel: 'Текст для отправки',
  chars: (n: number, shown: string) => `${shown} ${ruPlural(n, 'символ', 'символа', 'символов')}`,
  loading: 'Загрузка текста…',
  loadError: 'Не удалось загрузить текст.',
  copied: (what: string) => `Скопировано · ${what}`,
  synthOf: (ref: string) => `обзор ${ref}`,
  copyFailed: 'Не удалось скопировать.',
  shareFailed: 'Не удалось открыть меню «Поделиться».',
  sources: 'Источники',
  inference: '(Вывод)',
  aiFooter: 'Обзор создан ИИ на основе источников выше.',
  via: 'через Sensus',
};
