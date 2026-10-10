import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { readingFont, useTheme } from './theme';

/** Texto de leitura (versículos, verbetes, comentários). */
export function Body({
  children,
  reading = false,
  lines,
  style,
}: {
  children: ReactNode;
  reading?: boolean;
  lines?: number;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  return (
    <Text
      numberOfLines={lines}
      style={[
        {
          color: theme.text,
          fontSize: reading ? 17 : 15,
          lineHeight: reading ? 26 : 22,
          fontFamily: reading ? readingFont : undefined,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Linha pequena de metadados (origem, referência, tradição). */
export function Meta({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return (
    <Text style={[{ color: theme.textMuted, fontSize: 12, lineHeight: 16 }, style]}>{children}</Text>
  );
}

/** Subtítulo dentro de uma seção. */
export function Label({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: theme.accent,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      {children}
    </Text>
  );
}
