import { Pressable, Text, View } from 'react-native';
import type { Book } from '@sensus/core';
import { t } from '@/i18n';
import { Card, Heading } from './primitives';
import { Meta } from './text';
import { useTheme } from './theme';

/** Grupo de livros (AT ou NT). Cada livro expande em uma grade de capítulos. */
export function BookGroup({
  title,
  books,
  openBook,
  onToggle,
  onChapter,
}: {
  title: string;
  books: Book[];
  openBook: number | null;
  onToggle: (num: number | null) => void;
  onChapter: (book: number, chapter: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Heading level={3}>{title.toUpperCase()}</Heading>
      {books.map((book) => {
        const expanded = openBook === book.num;
        return (
          <Card key={book.num} style={{ padding: 0 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => onToggle(expanded ? null : book.num)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                backgroundColor: pressed ? theme.surfaceAlt : theme.surface,
                borderRadius: 14,
              })}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{book.name_pt}</Text>
                <Meta>{t('books.chapters', { count: book.chapters })}</Meta>
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 16 }}>{expanded ? '−' : '+'}</Text>
            </Pressable>
            {expanded ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  padding: 14,
                  paddingTop: 0,
                }}
              >
                {Array.from({ length: book.chapters }, (_, i) => i + 1).map((chapter) => (
                  <Pressable
                    key={chapter}
                    accessibilityRole="button"
                    accessibilityLabel={`${book.name_pt} ${chapter}`}
                    onPress={() => onChapter(book.num, chapter)}
                    style={({ pressed }) => ({
                      width: 52,
                      height: 44,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: pressed ? theme.selected : theme.chip,
                    })}
                  >
                    <Text style={{ color: theme.text, fontWeight: '600' }}>{chapter}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
