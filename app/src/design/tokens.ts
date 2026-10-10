// Design system do Sensus — tokens. Fonte da verdade visual do app.
// Origem: protótipo "Sensus Estudo Fluido" (docs/DESIGN_SYSTEM.md). Não use cores/tamanhos soltos
// em telas: tudo vem daqui (via useTheme()).

export type Scheme = 'light' | 'dark';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
  /** Fundo da seleção de versículos. */
  selected: string;
  chip: string;
  /** Pílula de citação (fundo/texto). */
  src: string;
  srcText: string;
  /** Moldura de inferência. */
  inf: string;
  infBorder: string;
  warn: string;
  warnText: string;
  danger: string;
  /** Destaque breve (ex.: versículo alvo de "ir para"). */
  highlight: string;
  /** Selos/etiquetas de tom (ex.: edição TR, "atravessa capítulo"). */
  tint: string;
  tintText: string;
  /** Véu atrás de folhas e popovers. */
  scrim: string;
}

/** Cor por tipo de fonte (tabela de origem do cite_id). Usada no ponto da pílula e nas marcas de tipo. */
export interface SourceTypeColors {
  txt: string;
  tok: string;
  lex: string;
  com: string;
  dic: string;
  xr: string;
  ent: string;
}

const lightPalette: Palette = {
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEBE2',
  text: '#1F1B16',
  muted: '#6B645A',
  border: '#DDD6C8',
  accent: '#7A4E1D',
  accentText: '#FFFFFF',
  selected: '#F0DFC0',
  chip: '#EFE6D6',
  src: '#E4ECE2',
  srcText: '#2E5A34',
  inf: '#EDF2F9',
  infBorder: '#5B7BA6',
  warn: '#FBE9CF',
  warnText: '#8A4B00',
  danger: '#B3261E',
  highlight: '#F6E2A8',
  tint: '#EADFCB',
  tintText: '#5B3A12',
  scrim: 'rgba(31,27,22,0.28)',
};

const darkPalette: Palette = {
  bg: '#16130F',
  surface: '#221E19',
  surfaceAlt: '#2B261F',
  text: '#F1EBE1',
  muted: '#A9A193',
  border: '#3D372E',
  accent: '#E0B274',
  accentText: '#1F1B16',
  selected: '#4A3A24',
  chip: '#302A22',
  src: '#22332A',
  srcText: '#A9D6B0',
  inf: '#1E2733',
  infBorder: '#7FA2CF',
  warn: '#3F2E14',
  warnText: '#F0C07A',
  danger: '#F2A39C',
  highlight: '#5C4A1E',
  tint: '#2C251C',
  tintText: '#E9C98F',
  scrim: 'rgba(0,0,0,0.5)',
};

const lightTypes: SourceTypeColors = {
  txt: '#7A4E1D', tok: '#3F6E8C', lex: '#3F6E8C', com: '#7B4B7A', dic: '#4F7348', xr: '#9A5B2E', ent: '#5E6B2F',
};
const darkTypes: SourceTypeColors = {
  txt: '#E0B274', tok: '#8DBBD8', lex: '#8DBBD8', com: '#D2A2D0', dic: '#A3CC98', xr: '#E5A577', ent: '#C3CF8A',
};

export const palettes: Record<Scheme, Palette> = { light: lightPalette, dark: darkPalette };
export const sourceTypes: Record<Scheme, SourceTypeColors> = { light: lightTypes, dark: darkTypes };

/** Prefixo do cite_id → chave de cor. */
export function sourceTypeOf(citeId: string): keyof SourceTypeColors {
  const p = citeId.slice(0, citeId.indexOf(':'));
  return (['txt', 'tok', 'lex', 'com', 'dic', 'xr', 'ent'] as const).find((k) => k === p) ?? 'txt';
}

// ---- tipografia ---------------------------------------------------------------------
// Quatro famílias com papéis fixos:
//   read  (Literata)          texto bíblico, títulos, trechos de fontes — leitura longa
//   ui    (Manrope)           interface: botões, rótulos, metadados
//   greek (Gentium Book Plus) grego e hebraico, sempre (inclusive dentro de texto em outra família)
//   mono  (IBM Plex Mono)     cite_id, coordenadas, códigos morfológicos

export const fontFamilies = {
  read: 'Literata_400Regular',
  readItalic: 'Literata_400Regular_Italic',
  readMedium: 'Literata_500Medium',
  readSemibold: 'Literata_600SemiBold',
  ui: 'Manrope_400Regular',
  uiMedium: 'Manrope_500Medium',
  uiSemibold: 'Manrope_600SemiBold',
  uiBold: 'Manrope_700Bold',
  greek: 'GentiumBookPlus_400Regular',
  greekBold: 'GentiumBookPlus_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export interface TextStyleToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
}

/** Escala tipográfica. Nomes por papel, não por tamanho. */
export const type = {
  /** Corpo do leitor bíblico. */
  scripture: { fontFamily: fontFamilies.read, fontSize: 17.5, lineHeight: 30 },
  /** Título do livro no leitor. */
  bookTitle: { fontFamily: fontFamilies.readSemibold, fontSize: 26, lineHeight: 32 },
  /** Número grande do capítulo (marcador de capítulo). */
  chapterNumber: { fontFamily: fontFamilies.readSemibold, fontSize: 34, lineHeight: 36 },
  /** Título de painel empilhado. */
  panelTitle: { fontFamily: fontFamilies.readSemibold, fontSize: 24, lineHeight: 29 },
  /** Referência no cabeçalho da folha. */
  sheetTitle: { fontFamily: fontFamilies.readSemibold, fontSize: 19, lineHeight: 24 },
  /** Título de lente / do topo. */
  lensTitle: { fontFamily: fontFamilies.readSemibold, fontSize: 17, lineHeight: 22 },
  /** Texto da IA (afirmações). */
  claim: { fontFamily: fontFamilies.ui, fontSize: 14.5, lineHeight: 23 },
  /** Trechos de fontes (comentários, verbetes, versículos em cards). */
  excerpt: { fontFamily: fontFamilies.read, fontSize: 14, lineHeight: 21.5 },
  /** Texto completo de uma fonte em painel. */
  fullText: { fontFamily: fontFamilies.read, fontSize: 15.5, lineHeight: 25.5 },
  /** Interface padrão. */
  body: { fontFamily: fontFamilies.ui, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: fontFamilies.ui, fontSize: 13.5, lineHeight: 19 },
  /** Botões e pílulas. */
  button: { fontFamily: fontFamilies.uiBold, fontSize: 12.5, lineHeight: 16 },
  /** Metadados, contagens. */
  meta: { fontFamily: fontFamilies.uiSemibold, fontSize: 12, lineHeight: 16 },
  /** Rótulos em caixa alta (sub-cabeçalhos, marcas de tipo, "Inferência"). */
  eyebrow: { fontFamily: fontFamilies.uiBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.7, textTransform: 'uppercase' },
  /** Pílula de citação. */
  cite: { fontFamily: fontFamilies.uiBold, fontSize: 11, lineHeight: 18 },
  /** Número de versículo (sobrescrito). */
  verseNumber: { fontFamily: fontFamilies.uiBold, fontSize: 10.5, lineHeight: 14 },
  /** Grego/hebraico inline (escala ~1.06 do texto ao redor; use greekFor()). */
  greek: { fontFamily: fontFamilies.greek, fontSize: 16, lineHeight: 25 },
  /** Lema em destaque (card de palavra). */
  lemma: { fontFamily: fontFamilies.greek, fontSize: 22, lineHeight: 27 },
  /** Lema gigante (painel da palavra). */
  lemmaHero: { fontFamily: fontFamilies.greek, fontSize: 34, lineHeight: 38 },
  mono: { fontFamily: fontFamilies.mono, fontSize: 11.5, lineHeight: 16 },
} satisfies Record<string, TextStyleToken>;

export type TypeVariant = keyof typeof type;

/** Grego/hebraico dentro de um texto de outra família: mesma linha, 6% maior. */
export function greekFor(base: TextStyleToken): TextStyleToken {
  return { fontFamily: fontFamilies.greek, fontSize: Math.round(base.fontSize * 1.06 * 2) / 2, lineHeight: base.lineHeight };
}

// ---- espaço, raios, sombras, movimento ---------------------------------------------------

/** Escala de espaçamento (px). */
export const space = { 0: 0, 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14, 8: 16, 9: 18, 10: 22, 11: 24, 12: 32 } as const;

/** Margem lateral do leitor e da folha. */
export const gutter = { reader: 22, sheet: 16 } as const;

export const radius = {
  xs: 4, // selos de edição, realce de palavra
  sm: 6, // pílula de citação, etiquetas
  md: 8, // botões pequenos, chips de pergunta
  lg: 10, // fatos, campos, botões de ação
  xl: 12, // botões rápidos, perguntas, campo do chat
  card: 14,
  pop: 20,
  sheet: 22,
  pill: 999,
} as const;

export const shadow = {
  /** Folha de estudo (projeta para cima). */
  sheet: { shadowColor: '#3C280A', shadowOpacity: 0.14, shadowRadius: 15, shadowOffset: { width: 0, height: -8 }, elevation: 16 },
  /** Popover de fonte e chat flutuante. */
  pop: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 20 },
  /** Bolinha do chat. */
  bubble: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  /** Faixa fixa (lado a lado). */
  pin: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  /** Segmento ativo. */
  segment: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 1, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
} as const;

export const motion = {
  /** Curva padrão de folhas, painéis e popovers: cubic-bezier(.2,.8,.2,1). */
  easing: [0.2, 0.8, 0.2, 1] as const,
  sheet: 320,
  panel: 280,
  pop: 260,
  chat: 280,
  fade: 200,
  selection: 180,
  /** Duração do realce de "ir para versículo". */
  flash: 1200,
} as const;

/** Alturas da folha de estudo (fração da altura disponível abaixo da barra superior). */
export const detents = {
  /** Espiar: referência, alcance, fatos e ações rápidas — sem IA. */
  peek: 0.3,
  /** Estudar: lentes; a seleção continua visível acima. */
  half: 0.56,
  /** Aprofundar: tela cheia. */
  full: 0.93,
} as const;
export type Detent = 'closed' | keyof typeof detents;

/** Medidas fixas de componentes. */
export const size = {
  topBar: 52,
  iconButton: 32,
  topBarButton: 36,
  quickAction: 40,
  input: 40,
  bubble: 54,
  handle: 22,
  minTouch: 44,
} as const;
