import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { fontFamilies, SensusThemeProvider, useSensusFonts, useTheme as useDesignTheme } from '@/design';
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
      <KeyboardProvider>
        <SensusThemeProvider>
          <AppStack />
        </SensusThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function AppStack() {
  const theme = useTheme();
  const { c } = useDesignTheme();
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
            <Stack.Screen
              name="settings"
              options={{
                title: t('settings.title'),
                headerStyle: { backgroundColor: c.bg },
                headerTintColor: c.accent,
                headerTitleStyle: { color: c.text, fontFamily: fontFamilies.readSemibold, fontSize: 17 },
                contentStyle: { backgroundColor: c.bg },
              }}
            />
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

