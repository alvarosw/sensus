// Bengali de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
export const bnCommentary = {
  rowTitle: 'ব্যাখ্যা ও ভাষ্য',
  title: 'ব্যাখ্যা ও ভাষ্য',
  help: 'আপনার পাঠে যে ঐতিহ্যগুলি দেখতে চান তা বেছে নিন: দৃষ্টিকোণ, ভাষ্য এবং AI যা ব্যবহার করে। বাকিগুলো পুরো অ্যাপে লুকানো থাকবে।',
  allTraditions: 'সব ঐতিহ্য',
  secTraditions: 'ঐতিহ্য',
  secSources: 'ভাষ্যের উৎস',
  sourcesHelp: 'কোনো ঐতিহ্য গৃহীত থাকলেও প্রতিটি উৎস আলাদাভাবে লুকানো যায়।',
  noSources: 'এই ডাটাবেসে কোনো ভাষ্য নেই।',
  hiddenNotice: 'আপনার পছন্দ অনুযায়ী অন্য ঐতিহ্যের ভাষ্য লুকানো আছে',
  adjust: 'সমন্বয় করুন',
  onlyTradition: (a: string) => `শুধু ${a}`,
  twoTraditions: (a: string, b: string) => `${a} ও ${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a}, ${b} ও আরও ${more}`,
  hiddenSources: (n: number) => (n === 1 ? '1টি উৎস লুকানো' : `${n}টি উৎস লুকানো`),
};
