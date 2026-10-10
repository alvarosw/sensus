// Barra superior (proto: .topbar): Livros · referência atual (abre "ir para") · Αα · fonte do texto.
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOOK_TABLE } from '@sensus/core';
import { Icon, TopBarButton, fontFamilies, size, type, useTheme } from '@/design';
import { useStudy } from '@/state/study';
import { useReaderNav } from '../reader/nav-store';
import { READER, SOURCE_LABEL } from '../reader/strings';

export function TopBar({ jumpOpen, booksOpen, onBooks, onJump }: { jumpOpen: boolean; booksOpen: boolean; onBooks: () => void; onJump: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const position = useReaderNav((s) => s.position);
  const greek = useStudy((s) => s.greek);
  const textSource = useStudy((s) => s.textSource);
  const name = BOOK_TABLE[position.book - 1]?.name_pt ?? '';
  const label = SOURCE_LABEL[textSource]?.short ?? textSource;

  const toggleGreek = () => {
    const s = useStudy.getState();
    s.toggleGreek();
    s.showToast({ text: useStudy.getState().greek ? READER.greekOn : READER.greekOff });
  };
  const toggleSource = () => {
    const s = useStudy.getState();
    s.setTextSource(s.textSource === 'blivre' ? 'kjv' : 'blivre');
  };

  return (
    <View
      testID="topbar"
      style={[
        {
          zIndex: 5,
          paddingTop: insets.top,
          height: size.topBar + insets.top,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          backgroundColor: `${c.bg}E0`,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },
        Platform.OS === 'web' ? ({ backdropFilter: 'blur(10px)' } as object) : null,
      ]}
    >
      <TopBarButton testID="btn-books" label={READER.books} active={booksOpen} onPress={onBooks}>
        <Icon name="menu" size={18} color={booksOpen ? c.accent : c.muted} />
      </TopBarButton>
      <Pressable
        testID="topbar-ref"
        accessibilityRole="button"
        accessibilityLabel={READER.currentRef(`${name} ${position.chapter}`)}
        accessibilityState={{ expanded: jumpOpen }}
        onPress={onJump}
        style={({ pressed }) => ({ flex: 1, height: 40, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}
      >
        <Text numberOfLines={1} style={{ ...type.lensTitle, color: c.text }}>{name} {position.chapter}</Text>
        <Text style={{ fontFamily: fontFamilies.uiMedium, fontSize: 12, color: c.muted }}>▾</Text>
      </Pressable>
      <TopBarButton testID="btn-greek" label={READER.greek} active={greek} onPress={toggleGreek}>
        <Text style={{ fontFamily: fontFamilies.greek, fontSize: 15, lineHeight: 20, color: greek ? c.accent : c.muted }}>Αα</Text>
      </TopBarButton>
      <TopBarButton testID="btn-source" label={READER.textSource(label)} onPress={toggleSource}>
        <Text style={{ fontFamily: fontFamilies.uiSemibold, fontSize: 13, color: c.muted }}>{label}</Text>
      </TopBarButton>
    </View>
  );
}
