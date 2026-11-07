// Peças da tela de tradições: chip de tradição (escolha) e linha de fonte com interruptor (mostrar ou esconder).
import { Pressable, Switch, View } from 'react-native';
import { radius, Txt, useTheme } from '@/design';

export function TraditionChip({ label, on, onPress, testID }: { label: string; on: boolean; onPress: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: on ? c.accent : c.border,
        backgroundColor: on ? c.selected : c.surface,
        borderRadius: radius.pill,
        paddingHorizontal: 14,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Txt v="button" tint={on ? c.accent : c.text}>{label}</Txt>
    </Pressable>
  );
}

export function SourceSwitchRow({
  name,
  detail,
  on,
  onChange,
  first,
  testID,
}: {
  name: string;
  detail: string;
  on: boolean;
  onChange: (on: boolean) => void;
  first: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt v="bodySm" bold>{name}</Txt>
        <Txt v="meta" color="muted">{detail}</Txt>
      </View>
      <Switch
        testID={testID}
        value={on}
        onValueChange={onChange}
        trackColor={{ false: c.border, true: c.accent }}
        thumbColor={c.surface}
        accessibilityLabel={name}
      />
    </View>
  );
}
