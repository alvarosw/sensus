// Minhas marcas (Livros → Explorar): filtros Tudo/Grifos/Notas, cores, livro; ordem Recentes ou Ordem bíblica; a lista
// e os estados vazios. Não tem diálogo de confirmação: apagar oferece Desfazer no aviso.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { BOOK_TABLE, bookNameOf, splitVid, type VerseRange } from '@sensus/core';
import { HIGHLIGHT_TINTS, HeaderBackButton, HighlightKey,  Segmented, SubHeader, Txt, fontFamilies, gutter, radius, size, useTheme } from '@/design';
import { currentLang } from '@/i18n/lang-store';
import { useReaderNav } from '@/state/reader-nav';
import { useStudy } from '@/state/study';
import { MARK_COLORS, useMarksStore, filterMarks, sortMarks, countByBook, type MarkColor, type MarkFilter, type MarkKind, type MarkOrder } from '@/user-data';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupByBook } from './list-model';
import { MarkRow } from './MarkRow';
import { useMarkRows } from './useMarkRows';
import { MARKS } from './strings';

const NO_FILTER: MarkFilter = { kind: 'all', colors: [], book: null };

/** Vai ao trecho da marca: o leitor abre no versículo (com realce) e seleciona o intervalo; sem versículo, o capítulo. */
function goTo(range: VerseRange, missing: boolean) {
  const { book, chapter } = splitVid(range.start);
  router.back();
  const nav = useReaderNav.getState();
  if (missing) {
    nav.goChapter(book, chapter);
    return;
  }
  nav.goVerse(range.start, { flash: true });
  useStudy.getState().setSelection(range.start, range.end);
}

export function MarksScreen() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const marks = useMarksStore((s) => s.marks);
  const loaded = useMarksStore((s) => s.loaded);
  const [filter, setFilter] = useState<MarkFilter>(NO_FILTER);
  const [kind, setKind] = useState<MarkKind>('all');
  const [order, setOrder] = useState<MarkOrder>('recent');
  const [bookOpen, setBookOpen] = useState(false);

  const shown = useMemo(() => sortMarks(filterMarks(marks, { ...filter, kind }), order), [marks, filter, kind, order]);
  const { texts, bibleName } = useMarkRows(shown);
  const perBook = useMemo(() => countByBook(marks), [marks]);
  const lang = currentLang();
  const bookLabel = (num: number) => bookNameOf(BOOK_TABLE[num - 1], num, lang);
  const filtered = kind !== 'all' || filter.colors.length > 0 || filter.book !== null;
  const toggleColor = (id: MarkColor) =>
    setFilter((f) => ({ ...f, colors: f.colors.includes(id) ? f.colors.filter((x) => x !== id) : [...f.colors, id] }));
  const clear = () => {
    setKind('all');
    setFilter(NO_FILTER);
  };

  return (
    <View testID="marks-screen" style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ height: size.topBar, flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter.reader }}>
        <HeaderBackButton label={MARKS.back} onPress={() => router.back()} testID="marks-back" />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter.reader, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <View style={{ gap: 2 }}>
          <Txt v="sheetTitle" style={{ fontFamily: fontFamilies.readSemibold }}>{MARKS.listTitle}</Txt>
          <Txt v="meta" color="muted">{MARKS.markCount(marks.length)}</Txt>
        </View>

        <Segmented<MarkKind>
          testID="marks-kind"
          value={kind}
          onChange={setKind}
          options={[
            { key: 'all', label: MARKS.filterAll },
            { key: 'highlights', label: MARKS.filterHighlights },
            { key: 'notes', label: MARKS.filterNotes },
          ]}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {MARK_COLORS.map((id) => {
            const on = filter.colors.includes(id);
            return (
              <Pressable key={id} testID={`marks-color-${id}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={MARKS.colorNames[id]} onPress={() => toggleColor(id)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: HIGHLIGHT_TINTS[scheme][id as HighlightKey].dot, borderWidth: on ? 3 : 0, borderColor: c.accent }} />
              </Pressable>
            );
          })}
          <Pressable testID="marks-book" accessibilityRole="button" onPress={() => setBookOpen((o) => !o)} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
            <Txt v="button">{filter.book === null ? MARKS.allBooks : bookLabel(filter.book)} ▾</Txt>
          </Pressable>
        </View>

        {bookOpen && (
          <View testID="marks-book-list" style={{ gap: 2 }}>
            <BookChoice label={MARKS.allBooks} active={filter.book === null} onPress={() => { setFilter((f) => ({ ...f, book: null })); setBookOpen(false); }} />
            {[...perBook.keys()].sort((a, b) => a - b).map((num) => (
              <BookChoice key={num} label={`${bookLabel(num)} (${perBook.get(num)})`} active={filter.book === num} onPress={() => { setFilter((f) => ({ ...f, book: num })); setBookOpen(false); }} />
            ))}
          </View>
        )}

        <Segmented<MarkOrder>
          testID="marks-order"
          value={order}
          onChange={setOrder}
          options={[
            { key: 'recent', label: MARKS.orderRecent },
            { key: 'biblical', label: MARKS.orderBiblical },
          ]}
        />

        {loaded && marks.length === 0 && (
          <View testID="marks-empty" style={{ paddingVertical: 36, gap: 8, alignItems: 'center' }}>
            <Txt v="body" bold style={{ fontFamily: fontFamilies.uiBold }}>{MARKS.emptyTitle}</Txt>
            <Txt v="meta" color="muted" center>{MARKS.emptyBody}</Txt>
          </View>
        )}
        {marks.length > 0 && shown.length === 0 && (
          <View testID="marks-nomatch" style={{ paddingVertical: 24, gap: 10, alignItems: 'center' }}>
            <Txt v="meta" color="muted">{MARKS.noMatch}</Txt>
            {filtered && (
              <Pressable accessibilityRole="button" onPress={clear} style={{ minHeight: 40, justifyContent: 'center' }}>
                <Txt v="button" color="accent">{MARKS.clearFilters}</Txt>
              </Pressable>
            )}
          </View>
        )}

        {order === 'biblical'
          ? groupByBook(shown).map((g) => (
              <View key={g.book} style={{ gap: 8 }}>
                <SubHeader label={bookLabel(g.book)} />
                {g.items.map((m) => (
                  <MarkRow key={m.id} mark={m} text={texts.get(m.id)} bibleName={bibleName} onGo={goTo} />
                ))}
              </View>
            ))
          : shown.map((m) => <MarkRow key={m.id} mark={m} text={texts.get(m.id)} bibleName={bibleName} onGo={goTo} />)}

        <Txt v="meta" color="muted" center style={{ marginTop: 8 }}>{MARKS.storageNotice}</Txt>
      </ScrollView>
    </View>
  );
}

function BookChoice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: active ? c.selected : undefined }}>
      <Txt v="body" color={active ? 'accent' : 'text'}>{label}</Txt>
    </Pressable>
  );
}
