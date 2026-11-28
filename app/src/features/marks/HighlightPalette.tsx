// Paleta de grifo: troca a barra de seleção, no mesmo lugar. Um toque na cor grifa o trecho; Remover aparece quando
// algum versículo já tem grifo. O aviso com Desfazer fica por conta de actions.ts.
import { Pressable, View } from 'react-native';
import { HIGHLIGHT_TINTS, HighlightKey,  Txt, radius, useTheme, fontFamilies } from '@/design';
import { MARK_COLORS, useMarksStore, overlaps, type MarkColor } from '@/user-data';
import { highlight, removeHighlight } from './actions';
import { MARKS } from './strings';

export function HighlightPalette({ start, end, onDone }: { start: number; end: number; onDone: () => void }) {
  const { c, scheme } = useTheme();
  const hasHighlight = useMarksStore((s) => s.marks.some((m) => m.color !== null && overlaps(m, start, end)));

  const paint = (color: MarkColor) => {
    onDone();
    void highlight(start, end, color);
  };
  const erase = () => {
    onDone();
    void removeHighlight(start, end);
  };

  return (
    <View testID="highlight-palette" accessibilityRole="toolbar" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {MARK_COLORS.map((id) => {
        const key = id as HighlightKey;
        const name = MARKS.colorNames[id];
        return (
          <Pressable
            key={id}
            testID={`palette-${id}`}
            accessibilityRole="button"
            accessibilityLabel={`${MARKS.highlight}: ${name}`}
            onPress={() => paint(id)}
            hitSlop={6}
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: HIGHLIGHT_TINTS[scheme][key].dot, borderWidth: 2, borderColor: c.surface }} />
          </Pressable>
        );
      })}
      {hasHighlight && (
        <Pressable
          testID="palette-remove"
          accessibilityRole="button"
          onPress={erase}
          style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <Txt v="button" style={{ fontFamily: fontFamilies.uiSemibold }}>{MARKS.remove}</Txt>
        </Pressable>
      )}
    </View>
  );
}
