// Configurações: pilha própria (Configurações > Assistente de IA > Chave de API, etc.). O "voltar" do
// sistema (Android) fecha um nível por vez; o botão de cabeçalho usa o mesmo caminho.
import { Stack, router } from 'expo-router';
import { fontFamilies, HeaderBackButton, useTheme } from '@/design';
import { SETTINGS_COPY as COPY } from '@/settings/strings';

export default function SettingsLayout() {
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.accent,
        headerTitleStyle: { color: c.text, fontFamily: fontFamilies.readSemibold, fontSize: 17 },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerLeft: () => <HeaderBackButton label={COPY.back} onPress={() => router.back()} testID="settings-back" />,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: COPY.title }} />
      <Stack.Screen name="ai" options={{ title: COPY.aiTitle }} />
      <Stack.Screen name="appearance" options={{ title: COPY.lookTitle }} />
      <Stack.Screen name="about" options={{ title: COPY.aboutTitle }} />
      <Stack.Screen name="sources" options={{ title: COPY.sourcesTitle }} />
    </Stack>
  );
}
