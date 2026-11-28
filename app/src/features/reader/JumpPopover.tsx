// "Ir para…" (proto: .jump), agora com referência ou palavra (docs/design/1a-busca.html): sob o campo, uma linha por
// interpretação (Ir para / Buscar; as duas quando o texto é ambíguo). Enter faz a primeira. Campo vazio: buscas
// recentes e os capítulos do livro atual.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOOK_TABLE, bibleAbbr } from '@sensus/core';
import { Icon, SubHeader, Txt, fontFamilies, radius, shadow, size, useTheme } from '@/design';
import { useStudy } from '@/state/study';
import { useReaderNav } from '@/state/reader-nav';
import { useBibles } from '@/data/bibles/bibles-store';
import { useAppPrefs } from '@/settings/app-prefs';
import { SEARCH, openSearch } from '@/features/search';
import { READER } from './strings';
import { bookName } from './chapters';
import { planJump, type JumpOption } from './jump-model';

export function JumpPopover({ onClose }: { onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const position = useReaderNav((s) => s.position);
  const recent = useAppPrefs((s) => s.recentSearches);
  const bible = bibleAbbr(useStudy((s) => s.textSource), useBibles((s) => s.catalog));
  const [text, setText] = useState('');
  const book = BOOK_TABLE[position.book - 1]!;
  const chapters = useMemo(() => Array.from({ length: book.chapters }, (_, i) => i + 1), [book]);
  const plan = useMemo(() => planJump(text, BOOK_TABLE, book), [text, book]);

  const go = (chapter: number) => {
    useReaderNav.getState().goChapter(book.num, chapter);
    onClose();
  };
  const run = (o: JumpOption) => {
    onClose();
    if (o.kind === 'search') {
      openSearch(o.query);
      return;
    }
    const { ref } = o;
    if (ref.wholeChapter) {
      useReaderNav.getState().goChapter(ref.book.num, ref.chapter);
      return;
    }
    // Seleção primeiro (abre a folha), depois o pedido de rolagem: um só caminho (reader-nav), que carrega o
    // capítulo do alvo (inclusive de outro livro) antes de rolar.
    useStudy.getState().setSelection(ref.range.start, ref.range.end);
    useReaderNav.getState().goVerse(ref.range.start, { flash: true });
  };
  const label = (o: JumpOption) =>
    o.kind === 'search'
      ? SEARCH.searchFor(o.query.trim(), bible)
      : SEARCH.goTo(`${bookName(o.ref.book.num)} ${o.ref.chapter}${o.ref.verse ? `:${o.ref.verse}${o.ref.verseEnd && o.ref.verseEnd !== o.ref.verse ? `–${o.ref.verseEnd}` : ''}` : ''}`);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 8 }}>
      <Pressable testID="jump-backdrop" accessibilityLabel={READER.close} onPress={onClose} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View
        testID="jump"
        accessibilityViewIsModal
        style={[
          { position: 'absolute', top: insets.top + size.topBar + 4, alignSelf: 'center', width: 300, maxWidth: '92%', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.card, padding: 12, gap: 10 },
          shadow.pop,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, borderRadius: radius.lg, height: 40, paddingHorizontal: 10 }}>
          <Icon name="search" size={15} color={c.muted} />
          <TextInput
            testID="jump-input"
            accessibilityLabel={SEARCH.placeholder}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => plan.options[0] && run(plan.options[0])}
            placeholder={SEARCH.placeholder}
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="go"
            autoFocus
            style={{ flex: 1, minWidth: 0, height: '100%', fontFamily: fontFamilies.ui, fontSize: 15, color: c.text }}
          />
        </View>
        {plan.bad && <Txt v="meta" tint={c.danger}>{READER.jumpUnknown}</Txt>}
        {plan.options.length > 0 && (
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, overflow: 'hidden' }}>
            {plan.options.map((o, i) => (
              <Pressable
                key={o.kind}
                testID={`jump-${o.kind}`}
                accessibilityRole="button"
                onPress={() => run(o)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, backgroundColor: i === 0 ? c.selected : c.surface, opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name={o.kind === 'search' ? 'search' : 'chevronRight'} size={16} color={c.accent} />
                <Txt v="bodySm" style={{ flex: 1 }} numberOfLines={2}>{label(o)}</Txt>
              </Pressable>
            ))}
          </View>
        )}
        {plan.options.length > 1 && <Txt v="meta" color="muted" style={{ fontSize: 11.5 }}>{SEARCH.enterHint}</Txt>}
        {!text.trim() && (
          <>
            {recent.length > 0 && (
              <View style={{ gap: 6 }}>
                <SubHeader label={SEARCH.recent} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {recent.map((r) => (
                    <Pressable key={r} testID={`jump-recent-${r}`} accessibilityRole="button" onPress={() => run({ kind: 'search', query: r })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.6 : 1 })}>
                      <Icon name="search" size={11} color={c.muted} />
                      <Txt v="meta">{r}</Txt>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <ScrollView style={{ maxHeight: 188 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} keyboardShouldPersistTaps="handled">
              {chapters.map((n) => (
                <Pressable
                  key={n}
                  testID={`jump-ch-${n}`}
                  accessibilityRole="button"
                  accessibilityLabel={READER.chapterAria(bookName(book.num), n)}
                  onPress={() => go(n)}
                  style={({ pressed }) => ({ width: 40, height: 34, borderRadius: radius.md, backgroundColor: n === position.chapter ? c.selected : c.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
                >
                  <Txt v="body" bold color={n === position.chapter ? 'accent' : 'text'} style={{ fontFamily: fontFamilies.uiBold }}>{n}</Txt>
                </Pressable>
              ))}
            </ScrollView>
            <Txt v="meta" color="muted" style={{ fontFamily: fontFamilies.ui, fontSize: 11.5, lineHeight: 16 }}>{READER.jumpNote}</Txt>
          </>
        )}
      </View>
    </View>
  );
}
