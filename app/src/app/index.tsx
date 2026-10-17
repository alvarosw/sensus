// Tela principal: leitor contínuo + barra superior + camadas (estudo, fontes, chat, aviso) sobre ele.
import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Book } from '@sensus/core';
import { size, space, useTheme } from '@/design';
import { ChatLayer } from '@/features/chat/ChatLayer';
import { ToastHost } from '@/features/common/Toast';
import { BACK_PRIORITY, useBackLayer, useRootBackHandler } from '@/features/common/back';
import { BookPicker, JumpPopover, PinnedBar, Reader, TopBar } from '@/features/reader';
import { useReaderNav } from '@/state/reader-nav';
import { ContextReturnPill } from '@/features/timeline/ContextReturnPill';
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

  // Voltar do sistema: fecha a camada mais à frente; na tela base, confirma a saída.
  useRootBackHandler();
  useBackLayer('books', booksOpen, () => setBooksOpen(false), BACK_PRIORITY.picker);
  useBackLayer('jump', jumpOpen, () => setJumpOpen(false), BACK_PRIORITY.jump);

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
      <ContextReturnPill top={insets.top + size.topBar + space[3]} />
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
        onTimeline={() => {
          setBooksOpen(false);
          router.push('/timeline');
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
