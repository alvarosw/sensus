// Busca de livro ou referência: sugestões enquanto digita e ações para a referência reconhecida.
import { useMemo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { formatReference, type Book } from '@sensus/core';
import { Button } from '@/ui/primitives';
import { Meta } from '@/ui/text';
import { readingFont, useTheme } from '@/ui/theme';
import { abbrOf, shortRef } from './abbrev';
import { analyzeQuery, type RefMatch } from './reference';
import { NAV } from './strings';

export function ReferenceSearch({
  books,
  query,
  onQueryChange,
  onOpenRef,
  onPickBook,
}: {
  books: readonly Book[];
  query: string;
  onQueryChange: (q: string) => void;
  onOpenRef: (match: RefMatch, target: 'reader' | 'study') => void;
  onPickBook: (book: Book) => void;
}) {
  const theme = useTheme();
  const analysis = useMemo(() => analyzeQuery(query, books), [query, books]);
  const ref = analysis.ref;

  function submit() {
    if (ref) onOpenRef(ref, 'reader');
    else if (analysis.suggestions[0]) onPickBook(analysis.suggestions[0]);
  }

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 14,
          backgroundColor: theme.surface,
          paddingLeft: 14,
          paddingRight: query ? 4 : 14,
        }}
      >
        <TextInput
          accessibilityLabel={NAV.searchLabel}
          value={query}
          onChangeText={onQueryChange}
          onSubmitEditing={submit}
          placeholder={NAV.searchPlaceholder}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="search"
          clearButtonMode="never"
          style={{ flex: 1, height: 48, color: theme.text, fontSize: 16 }}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={NAV.clearSearch}
            onPress={() => onQueryChange('')}
            hitSlop={10}
            style={{ width: 40, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: theme.textMuted, fontSize: 20 }}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {ref ? <RefPreview ref_={ref} books={books} onOpen={onOpenRef} /> : null}

      {analysis.suggestions.length > 0 ? (
        <View
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          {analysis.suggestions.map((book, i) => (
            <Pressable
              key={book.num}
              accessibilityRole="button"
              accessibilityLabel={book.name_pt}
              onPress={() => onPickBook(book)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: theme.border,
                backgroundColor: pressed ? theme.surfaceAlt : theme.surface,
              })}
            >
              <View
                style={{
                  minWidth: 46,
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  alignItems: 'center',
                  backgroundColor: theme.tint,
                }}
              >
                <Text style={{ color: theme.tintText, fontWeight: '700', fontSize: 14 }}>{abbrOf(book.num)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{book.name_pt}</Text>
                <Meta>{NAV.bookChapters(book.chapters)}</Meta>
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 18 }}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {analysis.unmatched ? <Meta>{NAV.unmatched}</Meta> : null}
    </View>
  );
}

function RefPreview({
  ref_,
  books,
  onOpen,
}: {
  ref_: RefMatch;
  books: readonly Book[];
  onOpen: (match: RefMatch, target: 'reader' | 'study') => void;
}) {
  const theme = useTheme();
  const short = shortRef(ref_.range);
  return (
    <View
      style={{
        backgroundColor: theme.selected,
        borderRadius: 14,
        padding: 14,
        gap: 12,
      }}
    >
      <View style={{ gap: 2 }}>
        <Meta>{ref_.wholeChapter ? NAV.openChapter(short) : NAV.read}</Meta>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', fontFamily: readingFont }}>
          {formatReference(ref_.range, books)}
        </Text>
      </View>
      {ref_.wholeChapter ? (
        <Button label={NAV.openChapter(short)} onPress={() => onOpen(ref_, 'reader')} />
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button label={NAV.read} onPress={() => onOpen(ref_, 'reader')} />
          </View>
          <View style={{ flex: 1.6 }}>
            <Button label={NAV.study(short)} variant="secondary" onPress={() => onOpen(ref_, 'study')} />
          </View>
        </View>
      )}
    </View>
  );
}
