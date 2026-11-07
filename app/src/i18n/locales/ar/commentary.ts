// Árabe de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
// Plural árabe: 1 singular, 2 dual, 3 a 10 plural, 11 ou mais singular.
const arPl = (n: number, one: string, two: string, few: string, many: string): string =>
  n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? few : many;

export const arCommentary = {
  rowTitle: 'التفسير والشروح',
  title: 'التفسير والشروح',
  help: 'اختر التقاليد التي تريد رؤيتها في الدراسة: العدسات والتعليقات وما يستخدمه الذكاء الاصطناعي. الباقي مخفي في التطبيق كله.',
  allTraditions: 'كل التقاليد',
  secTraditions: 'التقاليد',
  secSources: 'مصادر التعليق',
  sourcesHelp: 'يمكن إخفاء كل مصدر حتى لو كان تقليده مقبولًا.',
  noSources: 'لا توجد تعليقات في هذه القاعدة.',
  hiddenNotice: 'تعليقات من تقاليد أخرى مخفية بحسب تفضيلاتك',
  adjust: 'تعديل',
  // Resumo da preferência (linha de Configurações). Os rótulos das tradições vêm do núcleo (traditionLabel).
  onlyTradition: (a: string) => `فقط ${a}`,
  twoTraditions: (a: string, b: string) => `${a} و${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a}، ${b} و${more} أخرى`,
  hiddenSources: (n: number) => arPl(n, 'مصدر واحد مخفي', 'مصدران مخفيان', `${n} مصادر مخفية`, `${n} مصدر مخفي`),
};
