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
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Fonte de leitura para o texto bíblico (serifada). */
export const readingFont = Platform.select({ ios: 'Georgia', default: 'serif' });
