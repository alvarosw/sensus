import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SensusThemeProvider, useSensusFonts } from '@/design';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { DbProvider, useDbState } from '@/data/db-context';
import { t } from '@/i18n';
import { SettingsProvider } from '@/settings/settings-context';
import { LoadingView, ErrorView } from '@/ui/state';
import { useTheme } from '@/ui/theme';

export default function RootLayout() {
  const fontsReady = useSensusFonts();
  if (!fontsReady) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SensusThemeProvider>
        <AppStack />
      </SensusThemeProvider>
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
            <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
          </Stack>
        </DbGate>
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

