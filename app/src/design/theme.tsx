import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_400Regular_Italic } from '@expo-google-fonts/literata/400Regular_Italic';
import { Literata_500Medium } from '@expo-google-fonts/literata/500Medium';
import { Literata_600SemiBold } from '@expo-google-fonts/literata/600SemiBold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { GentiumBookPlus_400Regular } from '@expo-google-fonts/gentium-book-plus/400Regular';
import { GentiumBookPlus_700Bold } from '@expo-google-fonts/gentium-book-plus/700Bold';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { palettes, sourceTypes, type Palette, type Scheme, type SourceTypeColors } from './tokens';

export interface SensusTheme {
  scheme: Scheme;
  /** Cores da interface. */
  c: Palette;
  /** Cores por tipo de fonte (txt/tok/lex/com/dic/xr/ent). */
  st: SourceTypeColors;
}

export type SchemePreference = 'system' | Scheme;

interface ThemeCtx extends SensusTheme {
  preference: SchemePreference;
  setPreference: (p: SchemePreference) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function SensusThemeProvider({ children, initial = 'system' }: { children: ReactNode; initial?: SchemePreference }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<SchemePreference>(initial);
  const scheme: Scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo<ThemeCtx>(
    () => ({ scheme, c: palettes[scheme], st: sourceTypes[scheme], preference, setPreference }),
    [scheme, preference],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Tema atual. Fora do provider, cai no esquema do sistema (útil em testes). */
export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  const system = useColorScheme();
  if (ctx) return ctx;
  const scheme: Scheme = system === 'dark' ? 'dark' : 'light';
  return { scheme, c: palettes[scheme], st: sourceTypes[scheme], preference: 'system', setPreference: () => {} };
}

/** Carrega as quatro famílias do design system. Renderize o app só quando retornar true. */
export function useSensusFonts(): boolean {
  const [loaded, error] = useFonts({
    Literata_400Regular,
    Literata_400Regular_Italic,
    Literata_500Medium,
    Literata_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    GentiumBookPlus_400Regular,
    GentiumBookPlus_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  // Em erro de fonte, segue com as fontes do sistema em vez de travar o app.
  return loaded || error != null;
}
