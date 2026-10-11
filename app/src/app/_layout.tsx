import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, useState } from 'react';
import { SensusThemeProvider, useSensusFonts } from '@/design';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { DbProvider, useDbState } from '@/data/db-context';
import { t } from '@/i18n';
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
  return (
    <SettingsProvider>
      <DbProvider>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <DbGate>
          <Stack
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
          </Stack>
        </DbGate>
        <AttentionModal />
      </DbProvider>
    </SettingsProvider>
  );
}

/** Não renderiza as telas até o banco estar aberto. */
function DbGate({ children }: { children: ReactNode }) {
  const state = useDbState();
  if (state.status === 'loading') {
    return <LoadingView message={t('db.loading')} />;
  }
  if (state.status === 'error') {
    return <ErrorView message={t('db.error')} detail={state.message} />;
  }
  return <>{children}</>;
}

