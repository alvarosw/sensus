// Tela principal: leitor contínuo + barra superior + camadas (estudo, fontes, chat, aviso) sobre ele.
import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Book } from '@sensus/core';
import { size, useTheme } from '@/design';
import { ChatLayer } from '@/features/chat/ChatLayer';
import { ToastHost } from '@/features/common/Toast';
import { BookPicker } from '@/features/nav/BookPicker';
import { JumpPopover } from '@/features/nav/JumpPopover';
import { TopBar } from '@/features/nav/TopBar';
import { PinnedBar } from '@/features/reader/PinnedBar';
import { Reader } from '@/features/reader/Reader';
import { useReaderNav } from '@/features/reader/nav-store';
import { SourceLayer } from '@/features/sources/SourceLayer';
import { StudySheet } from '@/features/study/StudySheet';

export default function MainScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const position = useReaderNav((s) => s.position);
  const [rootH, setRootH] = useState(0);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [booksOpen, setBooksOpen] = useState(false);
  const areaHeight = Math.max(0, rootH - insets.top - size.topBar);

  const onLayout = useCallback((e: LayoutChangeEvent) => setRootH(e.nativeEvent.layout.height), []);
  const pick = (book: Book, chapter: number) => {
    setBooksOpen(false);
    useReaderNav.getState().goChapter(book.num, chapter);
  };

  return (
    <View testID="main" onLayout={onLayout} style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        jumpOpen={jumpOpen}
        booksOpen={booksOpen}
        onBooks={() => {
          setJumpOpen(false);
          setBooksOpen((o) => !o);
        }}
        onJump={() => {
          setBooksOpen(false);
          setJumpOpen((o) => !o);
        }}
      />
      <PinnedBar />
      <View style={{ flex: 1 }}>
        <Reader areaHeight={areaHeight} />
      </View>
      {jumpOpen && <JumpPopover onClose={() => setJumpOpen(false)} />}
      <BookPicker
        visible={booksOpen}
        currentBook={position.book}
        currentChapter={position.chapter}
        areaHeight={areaHeight}
        onPick={pick}
        onSettings={() => {
          setBooksOpen(false);
          router.push('/settings');
        }}
        onClose={() => setBooksOpen(false)}
      />
      <StudySheet />
      <SourceLayer />
      <ChatLayer />
      <ToastHost />
    </View>
  );
}
