// Árabe de app/src/features/share/strings.ts. A revisar por falante nativo.
// Mesmas chaves e assinaturas do pt; o TypeScript confere na chamada de `localized` (strings.ts).
import { arPlural } from '../../plural';

export const arShare = {
  barLabel: 'إجراءات التحديد',
  study: 'ادرس',
  copy: 'نسخ',
  share: 'مشاركة',
  shareMore: 'مشاركة…',
  copyTitle: 'نسخ المقطع',
  shareTitle: 'مشاركة المقطع',
  synthTitle: 'مشاركة الملخص',
  shareSynth: 'مشاركة الملخص',
  close: 'إغلاق',
  verseNumbers: 'أرقام الآيات',
  plainText: 'نص عادي',
  previewLabel: 'النص الذي سيُرسل',
  chars: (n: number, shown: string) => `${shown} ${arPlural(n, 'حرف', 'حرفان', 'أحرف', 'حرفًا')}`,
  loading: 'جارٍ تحميل النص…',
  loadError: 'تعذّر تحميل النص.',
  copied: (what: string) => `تم النسخ · ${what}`,
  synthOf: (ref: string) => `ملخص ${ref}`,
  copyFailed: 'تعذّر النسخ.',
  shareFailed: 'تعذّر فتح المشاركة.',
  sources: 'المصادر',
  inference: '(استنتاج)',
  aiFooter: 'ملخص أنشأه الذكاء الاصطناعي من المصادر أعلاه.',
  via: 'عبر Sensus',
};
