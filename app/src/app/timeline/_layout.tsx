// Linha do tempo: pilha própria (tela inicial, lista de uma linha, Bíblia inteira, Em paralelo). Mesmo cabeçalho
// das Configurações; o título da lista é o nome da linha (definido na própria tela).
import { Stack, router } from 'expo-router';
import { fontFamilies, HeaderBackButton, useTheme } from '@/design';
import { TL } from '@/features/timeline/strings';

export default function TimelineLayout() {
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.accent,
        headerTitleStyle: { color: c.text, fontFamily: fontFamilies.readSemibold, fontSize: 17 },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerLeft: () => <HeaderBackButton label={TL.back} onPress={() => router.back()} testID="timeline-back" />,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: TL.title }} />
      <Stack.Screen name="linha" options={{ title: TL.title }} />
      <Stack.Screen name="bible" options={{ title: TL.biblePlainTitle }} />
      <Stack.Screen name="paralelo" options={{ title: TL.parallelTitle }} />
    </Stack>
  );
}
