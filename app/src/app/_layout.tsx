import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { DbProvider, useDbState } from '@/data/db-context';
import { t } from '@/i18n';
import { SettingsProvider } from '@/settings/settings-context';
import { LoadingView, ErrorView } from '@/ui/state';
import { useTheme } from '@/ui/theme';

export default function RootLayout() {
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
            <Stack.Screen
              name="index"
              options={{
                title: t('app.name'),
                headerRight: () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('study.configure')}
                    onPress={() => router.push('/settings')}
                    hitSlop={8}
                  >
                    <Text style={{ color: theme.accent, fontWeight: '600' }}>{t('study.configure')}</Text>
                  </Pressable>
                ),
              }}
            />
            <Stack.Screen name="reader/[book]/[chapter]" options={{ title: t('reader.title') }} />
            <Stack.Screen name="study" options={{ title: t('study.title') }} />
            <Stack.Screen name="source/[cite]" options={{ title: t('source.title') }} />
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

