// Entrada "Minhas marcas" na seção Explorar do seletor de livros, com a contagem no subtítulo.
import { Pressable, View } from 'react-native';
import { Icon, Txt, radius, useTheme } from '@/design';
import { useMarksStore } from '@/user-data';
import { MARKS } from './strings';

export function MarksEntry({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  const count = useMarksStore((s) => s.marks.length);
  return (
    <Pressable
      testID="picker-marks"
      accessibilityRole="button"
      accessibilityLabel={MARKS.listTitle}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: radius.lg, backgroundColor: c.chip, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Txt v="bodySm" bold color="text">{MARKS.listTitle}</Txt>
        <Txt v="meta" color="muted">{MARKS.markCount(count)}</Txt>
      </View>
      <Icon name="chevronRight" size={16} color={c.muted} />
    </Pressable>
  );
}
