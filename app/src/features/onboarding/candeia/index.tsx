// Candeia do onboarding (ver docs/design/onboarding.md). ESBOÇO: assinaturas do contrato com um visual mínimo, para o
// fluxo poder ser montado em paralelo. A versão final (lâmpada, chama, luz que revela o texto) substitui este arquivo.
import { Pressable, Text, View } from 'react-native';

export interface CandeiaSceneProps {
  title: string;
  verse: string;
  reference: string;
  hint: string;
  ctaLabel: string;
  onContinue: () => void;
  rtl?: boolean;
  testID?: string;
}

export function CandeiaScene({ title, verse, reference, hint, ctaLabel, onContinue, rtl, testID }: CandeiaSceneProps) {
  const dir = rtl ? ({ writingDirection: 'rtl', textAlign: 'right' } as const) : null;
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: '#14110D', padding: 28, justifyContent: 'center', gap: 16 }}>
      <Text style={[{ color: '#F4C27A', fontSize: 22 }, dir]}>{verse}</Text>
      <Text style={[{ color: '#9C8F7C', fontSize: 14 }, dir]}>{reference}</Text>
      <Text style={{ color: '#9C8F7C', fontSize: 13 }}>{hint}</Text>
      <Text style={{ color: '#F7F5F0', fontSize: 34 }}>{title}</Text>
      <Pressable testID={testID ? `${testID}-continue` : undefined} onPress={onContinue}>
        <Text style={{ color: '#F4C27A', fontSize: 18 }}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

export interface CandeiaGlowProps {
  size?: number;
  testID?: string;
}

export function CandeiaGlow({ size = 40, testID }: CandeiaGlowProps) {
  return <View testID={testID} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F4C27A' }} />;
}

export interface CandeiaFinaleProps {
  verse: string;
  reference: string;
  ctaLabel: string;
  onDone: () => void;
  rtl?: boolean;
  testID?: string;
}

export function CandeiaFinale({ verse, reference, ctaLabel, onDone, rtl, testID }: CandeiaFinaleProps) {
  const dir = rtl ? ({ writingDirection: 'rtl', textAlign: 'right' } as const) : null;
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: '#F4C27A', padding: 28, justifyContent: 'center', gap: 16 }}>
      <Text style={[{ color: '#1F1B16', fontSize: 22 }, dir]}>{verse}</Text>
      <Text style={[{ color: '#6B645A', fontSize: 14 }, dir]}>{reference}</Text>
      <Pressable testID={testID ? `${testID}-done` : undefined} onPress={onDone}>
        <Text style={{ color: '#1F1B16', fontSize: 18 }}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}
