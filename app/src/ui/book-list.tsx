import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Book } from '@sensus/core';
import { abbrOf } from '@/features/nav/abbrev';
import { groupBooks } from '@/features/nav/categories';
import { useTheme } from './theme';

const HAIRLINE = StyleSheet.hairlineWidth;

/** Grade de livros de um testamento: cada categoria tem faixa tingida e tiles (sigla grande, nome pequeno). */
export function BookTileGrid({
  books,
  testament,
  onPick,
}: {
  books: readonly Book[];
  testament: 'OT' | 'NT';
  onPick: (book: Book) => void;
}) {
  const theme = useTheme();
  const groups = groupBooks(books, testament);
  return (
    <View style={{ gap: 18 }}>
      {groups.map(({ category, books: list }) =>
        list.length === 0 ? null : (
          <View key={category.id} style={{ gap: 8 }}>
            <View
              accessibilityRole="header"
              style={{
                alignSelf: 'flex-start',
                backgroundColor: theme.tint,
                borderRadius: 8,
                paddingVertical: 4,
                paddingHorizontal: 10,
              }}
            >
              <Text
                style={{
                  color: theme.tintText,
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {category.title}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
              {list.map((book) => (
                <BookTile key={book.num} book={book} onPress={() => onPick(book)} />
              ))}
            </View>
          </View>
        ),
      )}
    </View>
  );
}

function BookTile({ book, onPress }: { book: Book; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${book.name_pt}, ${book.chapters} capítulos`}
      onPress={onPress}
      style={({ pressed }) => ({ width: '25%', padding: 4, opacity: pressed ? 0.7 : 1 })}
    >
      <View
        style={{
          minHeight: 72,
          borderRadius: 14,
          borderWidth: HAIRLINE,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
          paddingHorizontal: 4,
          gap: 2,
        }}
      >
        <Text style={{ color: theme.accent, fontSize: 19, fontWeight: '700' }}>{abbrOf(book.num)}</Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: theme.textMuted, fontSize: 11, textAlign: 'center' }}
        >
          {book.name_pt}
        </Text>
      </View>
    </Pressable>
  );
}
