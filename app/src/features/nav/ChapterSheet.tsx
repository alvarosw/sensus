// Folha inferior (Modal deslizante) para escolher livro e capítulo.
// Abre direto nos capítulos quando recebe um livro; "Livros" volta para a grade de livros.
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Book } from '@sensus/core';
import { BookTileGrid } from '@/ui/book-list';
import { useTheme } from '@/ui/theme';
import { Segmented } from './Segmented';
import { NAV } from './strings';

export function ChapterSheet({
  visible,
  books,
  initialBook,
  currentBook,
  currentChapter,
  onPick,
  onClose,
}: {
  visible: boolean;
  books: readonly Book[];
  initialBook: Book | null;
  /** Destaca o capítulo atual (quando aberto a partir da leitura). */
  currentBook?: number;
  currentChapter?: number;
  onPick: (book: Book, chapter: number) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState<Book | null>(initialBook);
  const [testament, setTestament] = useState<'OT' | 'NT'>(initialBook?.testament ?? 'OT');

  // Ao abrir, volta ao livro pedido. Lido por ref para não reiniciar a navegação interna.
  const initialRef = useRef(initialBook);
  initialRef.current = initialBook;
  useEffect(() => {
    if (!visible) return;
    const start = initialRef.current;
    setBook(start);
    setTestament(start?.testament ?? 'OT');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={NAV.close}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.38)' }]}
        />
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '82%',
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: theme.border }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, gap: 8 }}>
            {book ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={NAV.books}
                onPress={() => setBook(null)}
                hitSlop={8}
                style={{ paddingVertical: 4, paddingRight: 8 }}
              >
                <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '600' }}>‹ {NAV.books}</Text>
              </Pressable>
            ) : null}
            <Text
              numberOfLines={1}
              accessibilityRole="header"
              style={{ flex: 1, color: theme.text, fontSize: 18, fontWeight: '700', textAlign: book ? 'right' : 'left' }}
            >
              {book ? book.name_pt : NAV.chooseBook}
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 12 }}>
            {book ? (
              <>
                <Text style={{ color: theme.textMuted, fontSize: 13 }}>{NAV.bookChapters(book.chapters)}</Text>
                <ChapterGrid
                  book={book}
                  highlight={currentBook === book.num ? currentChapter : undefined}
                  onPick={(chapter) => onPick(book, chapter)}
                />
              </>
            ) : (
              <>
                <Segmented<'OT' | 'NT'>
                  accessibilityLabel={NAV.chooseBook}
                  value={testament}
                  onChange={setTestament}
                  options={[
                    { value: 'OT', label: NAV.testamentOT },
                    { value: 'NT', label: NAV.testamentNT },
                  ]}
                />
                <BookTileGrid books={books} testament={testament} onPick={setBook} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ChapterGrid({
  book,
  highlight,
  onPick,
}: {
  book: Book;
  highlight?: number;
  onPick: (chapter: number) => void;
}) {
  const theme = useTheme();
  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
      {chapters.map((chapter) => {
        const current = chapter === highlight;
        return (
          <Pressable
            key={chapter}
            accessibilityRole="button"
            accessibilityLabel={NAV.chapterAria(book.name_pt, chapter)}
            accessibilityState={{ selected: current }}
            onPress={() => onPick(chapter)}
            style={({ pressed }) => ({ width: '20%', padding: 4, opacity: pressed ? 0.7 : 1 })}
          >
            <View
              style={{
                height: 52,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: current ? theme.selected : theme.chip,
                borderWidth: current ? 1 : 0,
                borderColor: theme.accent,
              }}
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{chapter}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
