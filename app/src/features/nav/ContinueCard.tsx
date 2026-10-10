import { Pressable, Text, View } from 'react-native';
import type { Book } from '@sensus/core';
import { readingFont, useTheme } from '@/ui/theme';
import { Label, Meta } from '@/ui/text';
import type { LastPosition } from './last-position';
import { NAV } from './strings';

/** Cartão com a última posição de leitura. */
export function ContinueCard({
  position,
  book,
  onPress,
}: {
  position: LastPosition;
  book: Book;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${NAV.continueReading}: ${book.name_pt} ${position.chapter}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: pressed ? theme.surfaceAlt : theme.surface,
      })}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Label>{NAV.continueReading}</Label>
        <Text
          numberOfLines={1}
          style={{ color: theme.text, fontSize: 21, fontWeight: '700', fontFamily: readingFont }}
        >
          {book.name_pt} {position.chapter}
        </Text>
        {position.verse ? <Meta>{NAV.verseOf(position.verse)}</Meta> : null}
      </View>
      <View
        style={{
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: theme.accent,
        }}
      >
        <Text style={{ color: theme.accentText, fontWeight: '700', fontSize: 14 }}>{NAV.resume}</Text>
      </View>
    </Pressable>
  );
}
