import { Platform, useColorScheme } from 'react-native';

export interface Theme {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentText: string;
  selected: string;
  chip: string;
  sourceChip: string;
  sourceChipText: string;
  inference: string;
  inferenceBorder: string;
  warn: string;
  warnText: string;
  danger: string;
  /** Destaque temporário de versículo (ao abrir por referência). */
  highlight: string;
  /** Faixa de cabeçalho dos grupos de livros. */
  tint: string;
  tintText: string;
}

const light: Theme = {
  scheme: 'light',
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEBE2',
  text: '#1F1B16',
  textMuted: '#6B645A',
  border: '#DDD6C8',
  accent: '#7A4E1D',
  accentText: '#FFFFFF',
  selected: '#F0DFC0',
  chip: '#EFE6D6',
  sourceChip: '#E4ECE2',
  sourceChipText: '#2E5A34',
  inference: '#EDF2F9',
  inferenceBorder: '#5B7BA6',
  warn: '#FBE9CF',
  warnText: '#8A4B00',
  danger: '#B3261E',
  highlight: '#F6E2A8',
  tint: '#EADFCB',
  tintText: '#5B3A12',
};

const dark: Theme = {
  scheme: 'dark',
  bg: '#16130F',
  surface: '#221E19',
  surfaceAlt: '#2B261F',
  text: '#F1EBE1',
  textMuted: '#A9A193',
  border: '#3D372E',
  accent: '#E0B274',
  accentText: '#1F1B16',
  selected: '#4A3A24',
  chip: '#302A22',
  sourceChip: '#22332A',
  sourceChipText: '#A9D6B0',
  inference: '#1E2733',
  inferenceBorder: '#7FA2CF',
  warn: '#3F2E14',
  warnText: '#F0C07A',
  danger: '#F2A39C',
  highlight: '#5C4A1E',
  tint: '#2C251C',
  tintText: '#E9C98F',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Fonte de leitura para o texto bíblico (serifada). */
export const readingFont = Platform.select({ ios: 'Georgia', default: 'serif' });

// ---- cores por tabela de citação (chips inline do texto rico) ---------------------

export type CiteTable =
  | 'verse_text'
  | 'token'
  | 'lexicon_entry'
  | 'commentary'
  | 'dictionary_entry'
  | 'xref'
  | 'entity';

export interface CiteTone {
  bg: string;
  fg: string;
}

const citeTonesLight: Record<CiteTable, CiteTone> = {
  verse_text: { bg: '#E4ECE2', fg: '#2E5A34' },
  token: { bg: '#E3E8F4', fg: '#33407A' },
  lexicon_entry: { bg: '#EFE3F1', fg: '#6A3B73' },
  commentary: { bg: '#F4E9D6', fg: '#7A4E1D' },
  dictionary_entry: { bg: '#DDEEEE', fg: '#2B5F5F' },
  xref: { bg: '#E9E9E6', fg: '#4A4A44' },
  entity: { bg: '#F5E1E1', fg: '#8A3434' },
};

const citeTonesDark: Record<CiteTable, CiteTone> = {
  verse_text: { bg: '#22332A', fg: '#A9D6B0' },
  token: { bg: '#262C42', fg: '#B5BFEB' },
  lexicon_entry: { bg: '#33243A', fg: '#D7B6E2' },
  commentary: { bg: '#3A2E1C', fg: '#E8C98F' },
  dictionary_entry: { bg: '#1F3434', fg: '#9FD2D2' },
  xref: { bg: '#2E2E2A', fg: '#CFCFC6' },
  entity: { bg: '#3D2424', fg: '#F0B3B3' },
};

export const CITE_NEUTRAL_LIGHT: CiteTone = { bg: '#EFEBE2', fg: '#4A4A44' };
export const CITE_NEUTRAL_DARK: CiteTone = { bg: '#302A22', fg: '#CFCFC6' };

/** Cores de chip por tabela de origem, no tema claro ou escuro. */
export function useCiteTones(): { tone: (table: CiteTable | undefined) => CiteTone; scheme: 'light' | 'dark' } {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const table = scheme === 'dark' ? citeTonesDark : citeTonesLight;
  const neutral = scheme === 'dark' ? CITE_NEUTRAL_DARK : CITE_NEUTRAL_LIGHT;
  return {
    scheme,
    tone: (t) => (t ? table[t] : neutral),
  };
}
