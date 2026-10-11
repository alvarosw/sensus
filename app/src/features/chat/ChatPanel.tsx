// Painel do chat (proto: .chat): cresce a partir da bolinha; cabeçalho, conversa e composer.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { router } from 'expo-router';
import { formatShortRef } from '@sensus/core';
import { fontFamilies, IconButton, LinkButton, motion, QuestionButton, radius, shadow, size, Txt, useTheme } from '@/design';
import { useStudy, LENS_LABELS } from '@/state/study';
import { BACK_PRIORITY, useBackLayer } from '../common/back';
import { usePresence } from '../common/motion';
import { useBooks } from '../common/hooks';
import { CHAT } from '../common/strings';
import { Composer } from './Composer';
import { bubbleLeft, clampBottom, type Metrics } from './geometry';
import { TurnView } from './Thread';
import { useSuggestions, type ChatApi } from './useChat';


const thread0Count = () => useStudy.getState().thread.length;
const SIDE_INSET = 8;
const TOP_GAP = 8;

export function ChatPanel({
  metrics,
  api,
  draft,
  setDraft,
  send,
}: {
  metrics: Metrics;
  api: ChatApi;
  draft: string;
  setDraft: (v: string) => void;
  send: (q: string) => void;
}) {
  const { c } = useTheme();
  const ownBooks = useBooks();
  const books = ownBooks.length > 0 ? ownBooks : api.passage.books;
  const chatOpen = useStudy((s) => s.chatOpen);
  const closeChat = useStudy((s) => s.closeChat);
  const thread = useStudy((s) => s.thread);
  const attachCount = useStudy((s) => s.attachments.length);
  const lens = useStudy((s) => s.lens);
  const bubble = useStudy((s) => s.bubble);
  const detent = useStudy((s) => s.detent);
  useBackLayer('chat', chatOpen, closeChat, BACK_PRIORITY.chat);
  const { progress, mounted } = usePresence(chatOpen, motion.chat);
  // Altura do teclado acompanhada pelo keyboard-controller (Android com edge-to-edge não redimensiona a janela).
  const kb = useSharedValue(0);
  const [kbOpen, setKbOpen] = useState(false);
  // Resposta aberta para seleção de texto (long-press numa resposta).
  const [picked, setPicked] = useState<string | null>(null);
  useBackLayer('answer-text', picked !== null, () => setPicked(null), BACK_PRIORITY.menu);
  const suggestions = useSuggestions(api.passage, api.range, api.hasProvider);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Ao começar uma pergunta nova, rola até ela (o início da resposta fica à vista, como numa leitura).
  const scrollTo = useRef<string | null>(null);
  const seen = useRef(thread0Count());

  // Referência estável (o worklet só agenda funções definidas no runtime JS).
  const scrollToEnd = useCallback(() => scrollRef.current?.scrollToEnd({ animated: true }), []);
  useKeyboardHandler(
    {
      onMove: (e) => {
        'worklet';
        kb.value = Math.max(0, e.height);
      },
      onEnd: (e) => {
        'worklet';
        kb.value = Math.max(0, e.height);
        if (e.height > 0) scheduleOnRN(scrollToEnd);
        scheduleOnRN(setKbOpen, e.height > 0);
      },
    },
    [scrollToEnd],
  );

  const rangeText = api.range && books.length > 0 ? formatShortRef(api.range.start, api.range.end, books, true) : null;

  // Foco no campo ao abrir com a conversa vazia ou com anexos (o teclado sobe depois da animação).
  useEffect(() => {
    if (!chatOpen) return;
    if (thread.length > 0 && attachCount === 0) return;
    const id = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen, attachCount]);

  useEffect(() => {
    if (thread.length > seen.current) scrollTo.current = thread[thread.length - 1]?.id ?? null;
    seen.current = thread.length;
  }, [thread]);
  const onTurnLayout = (id: string, y: number) => {
    if (scrollTo.current !== id) return;
    scrollTo.current = null;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 14), animated: true });
  };

  const top = metrics.insetTop + size.topBar + TOP_GAP;
  const bottomCenter = clampBottom(bubble.bottom, detent, metrics) + size.bubble / 2;
  const originX = bubbleLeft(bubble.side, metrics) + size.bubble / 2 - SIDE_INSET;
  const originY = metrics.height - bottomCenter - top;

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.7], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.15, 1]) }],
    // Sem teclado, o painel sobe o inset da barra de navegação (3 botões); com teclado, sobe com ele.
    bottom: 8 + Math.max(kb.value, metrics.insetBottom),
  }));

  if (!mounted) return null;
  const noProvider = !api.hasProvider;
  return (
    <Animated.View
      testID="chat"
      accessibilityViewIsModal
      accessibilityLabel={CHAT.title}
      pointerEvents={chatOpen ? 'auto' : 'none'}
      style={[
        {
          position: 'absolute',
          left: SIDE_INSET,
          right: SIDE_INSET,
          top,
          backgroundColor: c.surface,
          borderRadius: radius.sheet,
          borderWidth: 1,
          borderColor: c.border,
          overflow: 'hidden',
          transformOrigin: `${originX}px ${originY}px`,
          ...shadow.pop,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 10,
          paddingLeft: 16,
          paddingRight: 10,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="lensTitle" style={{ fontSize: 17, lineHeight: 22 }}>{CHAT.title}</Txt>
          <Txt v="meta" color="muted" style={{ fontSize: 12, fontFamily: fontFamilies.ui }} numberOfLines={1}>
            {`${rangeText ? `${rangeText} · ` : ''}${CHAT.subtitle}`}
          </Txt>
        </View>
        <IconButton testID="chat-minimize" icon="minus" label={CHAT.minimize} onPress={closeChat} />
      </View>

      <ScrollView
        ref={scrollRef}
        testID="chat-body"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {thread.length === 0 ? (
          <View testID="chat-empty" style={{ gap: 8 }}>
            <Txt v="bodySm" color="muted" style={{ fontSize: 13.5, lineHeight: 20 }}>
              {noProvider ? CHAT.introNoAi(rangeText) : CHAT.intro(rangeText, LENS_LABELS[lens])}
            </Txt>
            {noProvider ? (
              <View style={{ gap: 6, alignItems: 'flex-start' }}>
                <Txt v="bodySm" color="muted">{CHAT.noProvider}</Txt>
                <LinkButton
                  testID="chat-configure"
                  label={CHAT.configure}
                  onPress={() => {
                    closeChat();
                    router.push('/settings');
                  }}
                />
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                {suggestions.map((q, i) => (
                  <QuestionButton key={`${i}-${q}`} testID={`suggestion-${i}`} text={q} onPress={() => send(q)} />
                ))}
              </View>
            )}
          </View>
        ) : (
          thread.map((t) => (
            <TurnView key={t.id} turn={t} api={api} onAsk={send} onLayoutY={onTurnLayout} onPick={setPicked} />
          ))
        )}
        {api.contextBusy && thread.length > 0 ? <Txt v="meta" color="muted">{CHAT.contextLoading}</Txt> : null}
        {api.passage.error && !api.passage.context ? <Txt v="meta" color="danger">{CHAT.contextError}</Txt> : null}
        {noProvider && thread.length > 0 ? (
          <LinkButton testID="chat-configure" label={CHAT.configure} onPress={() => { closeChat(); router.push('/settings'); }} />
        ) : null}
      </ScrollView>

      {picked !== null ? (
        <View testID="answer-text" style={[StyleSheet.absoluteFill, { backgroundColor: c.surface, zIndex: 2 }]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              paddingLeft: 16,
              paddingRight: 10,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <Txt v="lensTitle" style={{ flex: 1, fontSize: 17, lineHeight: 22 }}>{CHAT.selectTitle}</Txt>
            <IconButton testID="answer-text-close" icon="close" label={CHAT.selectClose} onPress={() => setPicked(null)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Txt v="body" selectable style={{ fontSize: 15, lineHeight: 23 }}>{picked}</Txt>
          </ScrollView>
        </View>
      ) : null}

      <Composer
        ref={inputRef}
        value={draft}
        onChange={setDraft}
        onSend={() => {
          send(draft);
        }}
        onStop={api.stop}
        streaming={api.streaming}
        disabled={noProvider || api.contextBusy}
        bottomPad={10}
      />
    </Animated.View>
  );
}

