// Hindi de app/src/settings/commentary-strings.ts. A revisar por falante nativo.
export const hiCommentary = {
  rowTitle: 'व्याख्या और टीकाएँ',
  title: 'व्याख्या और टीकाएँ',
  help: 'अपने अध्ययन में जो परंपराएँ देखना चाहते हैं, उन्हें चुनें: लेंस, टीकाएँ और वह सब जो AI उपयोग करता है। बाकी पूरे ऐप में छिपी रहेंगी।',
  allTraditions: 'सभी परंपराएँ',
  secTraditions: 'परंपराएँ',
  secSources: 'टीका के स्रोत',
  sourcesHelp: 'परंपरा स्वीकृत होने पर भी हर स्रोत छिपाया जा सकता है।',
  noSources: 'इस डेटाबेस में कोई टीका नहीं है।',
  hiddenNotice: 'आपकी प्राथमिकताओं के कारण अन्य परंपराओं की टीकाएँ छिपी हैं',
  adjust: 'समायोजित करें',
  onlyTradition: (a: string) => `केवल ${a}`,
  twoTraditions: (a: string, b: string) => `${a} और ${b}`,
  manyTraditions: (a: string, b: string, more: number) => `${a}, ${b} और ${more} अन्य`,
  hiddenSources: (n: number) => (n === 1 ? '1 स्रोत छिपा है' : `${n} स्रोत छिपे हैं`),
};
