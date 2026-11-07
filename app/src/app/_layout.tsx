import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, useRef, useState } from 'react';
import { SensusThemeProvider, useSensusFonts } from '@/design';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { DbProvider, useDbState } from '@/data/db-context';
import { useDataStore } from '@/data/data-store';
import { useBibles } from '@/data/bibles/bibles-store';
import { shouldPromptFirstRun } from '@/data/plan';
import { t, useLang } from '@/i18n';
import { SettingsProvider } from '@/settings/settings-context';
import { AttentionModal } from '@/settings/AttentionModal';
import { useAppPrefs } from '@/settings/app-prefs';
import { LoadingView, ErrorView } from '@/ui/state';
import { useTheme } from '@/ui/theme';

export default function RootLayout() {
  const fontsReady = useSensusFonts();
  const prefsReady = useAppPrefsBoot();
  if (!fontsReady || !prefsReady) return null;
  return <RootProviders />;
}

/** Carrega as preferências de aparência e leitura antes de montar o app (o tema inicial depende delas). */
function useAppPrefsBoot(): boolean {
  const loaded = useAppPrefs((s) => s.loaded);
  useEffect(() => {
    void useAppPrefs.getState().load();
  }, []);
  return loaded;
}

function RootProviders() {
  // Lido uma vez, depois de carregado: o tema escolhido nas Configurações vale desde o início.
  const [initialTheme] = useState(() => useAppPrefs.getState().theme);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SensusThemeProvider initial={initialTheme}>
          <AppStack />
        </SensusThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function AppStack() {
  const theme = useTheme();
  // Trocar o idioma remonta as telas (os textos leem o idioma na hora); banco e preferências ficam de pé.
  const lang = useLang();
  return (
    <SettingsProvider>
      <DbProvider>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <DbGate>
          <Stack
            key={lang}
            screenOptions={{
              headerStyle: { backgroundColor: theme.surface },
              headerTintColor: theme.accent,
              headerTitleStyle: { color: theme.text },
              contentStyle: { backgroundColor: theme.bg },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            {/* Pilha própria em settings/_layout.tsx (cabeçalhos e voltar do design system). */}
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            {/* Pilha própria em timeline/_layout.tsx (tela inicial, lista de linha, Bíblia inteira, paralelo). */}
            <Stack.Screen name="timeline" options={{ headerShown: false }} />
            <Stack.Screen name="data-setup" options={{ headerShown: false }} />
          </Stack>
          {/* Depois da pilha: a oferta abre a tela de dados quando a navegação já está montada. */}
          <DataSetupGate />
        </DbGate>
        <AttentionModal />
      </DbProvider>
    </SettingsProvider>
  );
}

/**
 * Abre a tela de dados de estudo uma vez por execução quando ela faz sentido (ver shouldPromptFirstRun):
 * primeira abertura sem os dados completos, ou dados instalados mais antigos que o manifesto.
 */
function DataSetupGate() {
  const edition = useDataStore((s) => s.edition);
  const installedVersion = useDataStore((s) => s.installed?.dataVersion ?? null);
  const manifest = useDataStore((s) => s.manifest);
  const deferredVersion = useDataStore((s) => s.deferredVersion);
  const shown = useRef(false);

  useEffect(() => {
    useDataStore.getState().load();
    useBibles.getState().load();
    void useDataStore.getState().refreshManifest();
  }, []);

  const prompt =
    edition !== null &&
    shouldPromptFirstRun({ activeEdition: edition, installedVersion, manifest, deferredVersion });

  useEffect(() => {
    if (!prompt || shown.current) return;
    shown.current = true;
    router.push('/data-setup');
  }, [prompt]);

  return null;
}

/** Não renderiza as telas até o banco estar aberto. */
function DbGate({ children }: { children: ReactNode }) {
  const state = useDbState();
  if (state.status === 'loading') {
    return <LoadingView message={t('db.loading')} />;
  }
  if (state.status === 'error') {
    // O texto técnico do erro (mensagem de desenvolvedor) só aparece em desenvolvimento; ao usuário, só a frase traduzida.
    return <ErrorView message={t('db.error')} detail={__DEV__ ? state.message : undefined} />;
  }
  return <>{children}</>;
}

