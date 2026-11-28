// Folha "Livros com resultados": os livros que têm resultado (no testamento escolhido), com a contagem, por testamento.
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { testamentOfBook, type Vid } from '@sensus/core';
import { SubHeader, Txt, radius, shadow, useTheme } from '@/design';
import { useLang } from '@/i18n/lang-store';
import { countByBook, hitBookName } from './search-model';
import { useSearch } from './search-store';
import { SEARCH } from './strings';

export function BookFilterSheet({ hits, onClose }: { hits: Vid[]; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const book = useSearch((s) => s.book);
  const counts = countByBook(hits);
  const pick = (b: number | null) => {
    useSearch.getState().setBook(b);
    onClose();
  };
  const row = (key: string, label: string, count: number, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      testID={`search-book-${key}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, borderRadius: radius.lg, backgroundColor: selected ? c.selected : 'transparent' }}
    >
      <Txt v="body" bold color={selected ? 'accent' : 'text'}>{label}</Txt>
      <Txt v="meta" color="muted">{String(count)}</Txt>
    </Pressable>
  );
  let lastTestament: string | null = null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
      <Pressable testID="search-books-scrim" accessibilityRole="button" accessibilityLabel={SEARCH.back} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
      <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '72%', backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: insets.bottom + 12 }, shadow.sheet]}>
        <View style={{ height: 22, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: c.border }} />
        </View>
        <Txt v="lensTitle" style={{ paddingHorizontal: 20, paddingBottom: 6 }}>{SEARCH.booksWithHits}</Txt>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 8 }}>
          {row('all', SEARCH.allBooks, hits.length, book === null, () => pick(null))}
          {counts.map(({ book: b, count }) => {
            const t = testamentOfBook(b);
            const head = t !== lastTestament ? <View key={`h${t}`} style={{ paddingHorizontal: 12, paddingTop: 10 }}><SubHeader label={t === 'OT' ? SEARCH.oldTestament : SEARCH.newTestament} /></View> : null;
            lastTestament = t;
            return [head, row(String(b), hitBookName(b, lang), count, book === b, () => pick(b))];
          })}
        </ScrollView>
      </View>
    </View>
  );
}
