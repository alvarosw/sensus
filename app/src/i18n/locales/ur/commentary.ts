// Urdu de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
export const urCommentary = {
  rowTitle: 'تشریح اور تفاسیر',
  title: 'تشریح اور تفاسیر',
  help: 'اپنے مطالعے میں جو روایات دیکھنا چاہتے ہیں انہیں چنیں: زاویے، تفاسیر اور وہ سب جو AI استعمال کرتا ہے۔ باقی پوری ایپ میں چھپی رہیں گی۔',
  allTraditions: 'تمام روایات',
  secTraditions: 'روایات',
  secSources: 'تفسیری ماخذ',
  sourcesHelp: 'روایت قبول ہونے کے باوجود ہر ماخذ الگ سے چھپایا جا سکتا ہے۔',
  noSources: 'اس ڈیٹا بیس میں کوئی تفسیر نہیں ہے۔',
  hiddenNotice: 'آپ کی ترجیحات کے باعث دیگر روایات کی تفاسیر چھپی ہوئی ہیں',
  adjust: 'ایڈجسٹ کریں',
  onlyTradition: (a: string) => `صرف ${a}`,
  twoTraditions: (a: string, b: string) => `${a} اور ${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a}، ${b} اور ${more} مزید`,
  hiddenSources: (n: number) => (n === 1 ? '1 ماخذ چھپا ہوا' : `${n} ماخذ چھپے ہوئے`),
};
