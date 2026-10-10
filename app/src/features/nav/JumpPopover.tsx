// "Ir para…" (proto: .jump): campo de referência, capítulos do livro atual e nota sobre a rolagem contínua.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOOK_TABLE } from '@sensus/core';
import { Txt, fontFamilies, radius, shadow, size, useTheme } from '@/design';
import { useStudy } from '@/state/study';
import { useReaderNav } from '../reader/nav-store';
import { READER } from '../reader/strings';
import { analyzeQuery } from './reference';

export function JumpPopover({ onClose }: { onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const position = useReaderNav((s) => s.position);
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);
  const book = BOOK_TABLE[position.book - 1]!;
  const chapters = useMemo(() => Array.from({ length: book.chapters }, (_, i) => i + 1), [book]);

  const go = (chapter: number) => {
    useReaderNav.getState().goChapter(book.num, chapter);
    onClose();
  };
  const submit = () => {
    // "2:5" sem livro vale para o livro atual.
    const q = /^\s*\d+\s*([:.,]\s*\d+)?(\s*[-–]\s*\d+)?\s*$/.test(text) ? `${book.name_pt} ${text}` : text;
    const { ref } = analyzeQuery(q, BOOK_TABLE);
    if (!ref) {
      setBad(true);
      return;
    }
    onClose();
    if (ref.wholeChapter) {
      useReaderNav.getState().goChapter(ref.book.num, ref.chapter);
      return;
    }
    const s = useStudy.getState();
    s.setSelection(ref.range.start, ref.range.end);
    s.jumpTo(ref.range.start);
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 8 }}>
      <Pressable testID="jump-backdrop" accessibilityLabel={READER.close} onPress={onClose} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View
        testID="jump"
        accessibilityViewIsModal
        style={[
          {
            position: 'absolute',
            top: insets.top + size.topBar + 4,
            alignSelf: 'center',
            width: 260,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.card,
            padding: 12,
            gap: 8,
          },
          shadow.pop,
        ]}
      >
        <TextInput
          testID="jump-input"
          accessibilityLabel={READER.jumpLabel}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setBad(false);
          }}
          onSubmitEditing={submit}
          placeholder={READER.jumpPlaceholder}
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="go"
          style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, borderRadius: radius.lg, height: 36, paddingHorizontal: 10, fontFamily: fontFamilies.ui, fontSize: 15, color: c.text }}
        />
        {bad && <Txt v="meta" tint={c.danger}>{READER.jumpUnknown}</Txt>}
        <ScrollView style={{ maxHeight: 188 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} keyboardShouldPersistTaps="handled">
          {chapters.map((n) => (
            <Pressable
              key={n}
              testID={`jump-ch-${n}`}
              accessibilityRole="button"
              accessibilityLabel={READER.chapterAria(book.name_pt, n)}
              onPress={() => go(n)}
              style={({ pressed }) => ({ width: 40, height: 34, borderRadius: radius.md, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
            >
              <Txt v="body" bold style={{ fontFamily: fontFamilies.uiBold }}>{n}</Txt>
            </Pressable>
          ))}
        </ScrollView>
        <Txt v="meta" color="muted" style={{ fontFamily: fontFamilies.ui, fontSize: 11.5, lineHeight: 16 }}>{READER.jumpNote}</Txt>
      </View>
    </View>
  );
}
