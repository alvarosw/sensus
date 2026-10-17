// Seletor de livros e capítulos (folha inferior sobre o leitor). Livros por categoria, AT/NT, capítulos do livro
// escolhido e atalho para as configurações.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOOK_TABLE, type Book, type Testament } from '@sensus/core';
import { Icon, IconButton, Segmented, SubHeader, Txt, fontFamilies, motion, radius, shadow, useTheme } from '@/design';
import { TL } from '@/features/timeline';
import { READER } from './strings';
import { abbrOf } from './abbrev';
import { groupBooks } from './categories';

export function BookPicker({
  visible,
  currentBook,
  currentChapter,
  areaHeight,
  onPick,
  onSettings,
  onTimeline,
  onClose,
}: {
  visible: boolean;
  currentBook: number;
  currentChapter: number;
  areaHeight: number;
  onPick: (book: Book, chapter: number) => void;
  onSettings: () => void;
  /** Abre a linha do tempo (seção Explorar). */
  onTimeline: () => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [testament, setTestament] = useState<Testament>(BOOK_TABLE[currentBook - 1]?.testament ?? 'NT');
  const [book, setBook] = useState<Book | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setBook(null);
      setTestament(BOOK_TABLE[currentBook - 1]?.testament ?? 'NT');
    }
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: motion.sheet,
      easing: Easing.bezier(...motion.easing),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;
  const sheetMax = Math.max(320, Math.round(areaHeight * 0.82));
  const groups = groupBooks(BOOK_TABLE, testament);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 9, justifyContent: 'flex-end' }}>
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: anim }}>
        <Pressable testID="books-scrim" accessibilityRole="button" accessibilityLabel={READER.close} onPress={onClose} style={{ flex: 1, backgroundColor: c.scrim }} />
      </Animated.View>
      <Animated.View
        testID="book-picker"
        accessibilityViewIsModal
        style={[
          {
            maxHeight: sheetMax,
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingBottom: insets.bottom + 8,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [sheetMax, 0] }) }],
          },
          shadow.sheet,
        ]}
      >
        <View style={{ height: 22, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: c.border }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 }}>
          {book && (
            <IconButton testID="books-back" icon="back" label={READER.back} onPress={() => setBook(null)} />
          )}
          <Txt v="sheetTitle" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>{book ? book.name_pt : READER.pickBook}</Txt>
          <IconButton testID="books-close" icon="close" label={READER.close} onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {book ? (
            <>
              <Txt v="meta" color="muted">{READER.chaptersOf(book.chapters)}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {Array.from({ length: book.chapters }, (_, i) => i + 1).map((n) => {
                  const current = book.num === currentBook && n === currentChapter;
                  return (
                    <Pressable
                      key={n}
                      testID={`picker-ch-${n}`}
                      accessibilityRole="button"
                      accessibilityLabel={READER.chapterAria(book.name_pt, n)}
                      accessibilityState={{ selected: current }}
                      onPress={() => onPick(book, n)}
                      style={({ pressed }) => ({
                        width: '17.4%',
                        height: 44,
                        borderRadius: radius.lg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: current ? c.selected : c.chip,
                        borderWidth: 1,
                        borderColor: current ? c.accent : 'transparent',
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Txt v="body" bold color={current ? 'accent' : 'text'} style={{ fontFamily: fontFamilies.uiBold }}>{n}</Txt>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <View style={{ gap: 8 }}>
                <SubHeader label={TL.explore} />
                <Pressable
                  testID="picker-timeline"
                  accessibilityRole="button"
                  accessibilityLabel={TL.title}
                  onPress={onTimeline}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    minHeight: 52,
                    paddingHorizontal: 12,
                    borderRadius: radius.lg,
                    backgroundColor: c.chip,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Txt v="bodySm" bold color="text">{TL.title}</Txt>
                    <Txt v="meta" color="muted">{TL.entrySub}</Txt>
                  </View>
                  <Icon name="chevronRight" size={16} color={c.muted} />
                </Pressable>
              </View>
              <Segmented<Testament>
                testID="books-testament"
                value={testament}
                onChange={setTestament}
                options={[
                  { key: 'OT', label: READER.testamentOT },
                  { key: 'NT', label: READER.testamentNT },
                ]}
              />
              {groups.map((g) => (
                <View key={g.category.id} style={{ gap: 8 }}>
                  <SubHeader label={g.category.title} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {g.books.map((b) => {
                      const current = b.num === currentBook;
                      return (
                        <Pressable
                          key={b.num}
                          testID={`picker-book-${b.num}`}
                          accessibilityRole="button"
                          accessibilityLabel={b.name_pt}
                          accessibilityState={{ selected: current }}
                          onPress={() => (b.chapters === 1 ? onPick(b, 1) : setBook(b))}
                          style={({ pressed }) => ({
                            width: '31.5%',
                            minHeight: 44,
                            borderRadius: radius.lg,
                            paddingHorizontal: 4,
                            paddingVertical: 6,
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1,
                            backgroundColor: current ? c.selected : c.chip,
                            borderWidth: 1,
                            borderColor: current ? c.accent : 'transparent',
                            opacity: pressed ? 0.6 : 1,
                          })}
                        >
                          {/* Uma linha só, sem quebrar palavra: nomes longos (ex.: "1 Tessalonicenses") usam corpo menor. */}
                          <Txt
                            v="bodySm"
                            bold
                            center
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            color={current ? 'accent' : 'text'}
                            style={b.name_pt.length > 11 ? { fontSize: 11.5, lineHeight: 15 } : undefined}
                          >
                            {b.name_pt}
                          </Txt>
                          <Txt v="meta" color="muted" style={{ fontSize: 10.5, lineHeight: 13 }}>{abbrOf(b.num)}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingTop: 4, alignItems: 'flex-start' }}>
          <Pressable
            testID="books-settings"
            accessibilityRole="button"
            accessibilityLabel={READER.settings}
            onPress={onSettings}
            hitSlop={4}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingRight: 8, opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name="gear" size={16} color={c.accent} />
            <Txt v="button" color="accent">{READER.settings}</Txt>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
