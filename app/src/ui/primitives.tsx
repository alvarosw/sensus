import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Heading({ children, level = 2 }: { children: ReactNode; level?: 1 | 2 | 3 }) {
  const theme = useTheme();
  const size = level === 1 ? 22 : level === 2 ? 17 : 14;
  return (
    <Text
      accessibilityRole="header"
      style={{ color: theme.text, fontSize: size, fontWeight: '700', lineHeight: size * 1.35 }}
    >
      {children}
    </Text>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return (
    <Text style={[{ color: theme.textMuted, fontSize: 13, lineHeight: 18 }, style]}>{children}</Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const palette =
    variant === 'primary'
      ? { bg: theme.accent, fg: theme.accentText, border: theme.accent }
      : variant === 'secondary'
        ? { bg: theme.surface, fg: theme.accent, border: theme.accent }
        : { bg: 'transparent', fg: theme.accent, border: 'transparent' };
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.fg} /> : null}
      <Text style={{ color: palette.fg, fontWeight: '600', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export type ChipTone = 'neutral' | 'source' | 'warn' | 'danger';

export function Chip({
  label,
  onPress,
  tone = 'neutral',
  selected = false,
}: {
  label: string;
  onPress?: () => void;
  tone?: ChipTone;
  selected?: boolean;
}) {
  const theme = useTheme();
  const colors =
    tone === 'source'
      ? { bg: theme.sourceChip, fg: theme.sourceChipText }
      : tone === 'warn'
        ? { bg: theme.warn, fg: theme.warnText }
        : tone === 'danger'
          ? { bg: theme.warn, fg: theme.danger }
          : { bg: theme.chip, fg: theme.text };
  const bg = selected ? theme.accent : colors.bg;
  const fg = selected ? theme.accentText : colors.fg;
  const body = (
    <Text numberOfLines={1} style={{ color: fg, fontSize: 12, fontWeight: '600' }}>
      {label}
    </Text>
  );
  if (!onPress) {
    return <View style={[styles.chip, { backgroundColor: bg }]}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

/** Seção recolhível (usada no painel hermenêutico). */
export function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [
          styles.sectionHeader,
          { backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
        ]}
      >
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{title}</Text>
        {count !== undefined ? (
          <View style={[styles.countBadge, { backgroundColor: theme.chip }]}>
            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '600' }}>{count}</Text>
          </View>
        ) : null}
        <Text style={{ color: theme.textMuted, fontSize: 16, marginLeft: 8 }}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <View style={[styles.sectionBody, { borderTopColor: theme.border }]}>{children}</View> : null}
    </Card>
  );
}

/** Item tocável de uma lista de conteúdo, com rótulo de origem. */
export function Item({
  onPress,
  children,
  accessibilityLabel,
}: {
  onPress?: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const content = <View style={[styles.item, { borderColor: theme.border }]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    maxWidth: 260,
    alignSelf: 'flex-start',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sectionBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 14,
  },
  countBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  item: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    paddingVertical: 2,
    gap: 4,
  },
});
