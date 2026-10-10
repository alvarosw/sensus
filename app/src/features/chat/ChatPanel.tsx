// Painel do chat (proto: .chat): cresce a partir da bolinha; cabeçalho, conversa e composer.
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { router } from 'expo-router';
import { formatShortRef } from '@sensus/core';
import { fontFamilies, IconButton, LinkButton, motion, QuestionButton, radius, shadow, size, Txt, useTheme } from '@/design';
import { useStudy, LENS_LABELS } from '@/state/study';
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

function useKeyboardHeight(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    // No Android a janela já se ajusta ao teclado; só o iOS precisa do deslocamento manual.
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillChangeFrame', (e) => setH(Math.max(0, e.endCoordinates.height)));
    const hide = Keyboard.addListener('keyboardWillHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}

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
  const books = useBooks();
  const chatOpen = useStudy((s) => s.chatOpen);
  const closeChat = useStudy((s) => s.closeChat);
  const thread = useStudy((s) => s.thread);
  const attachCount = useStudy((s) => s.attachments.length);
  const lens = useStudy((s) => s.lens);
  const bubble = useStudy((s) => s.bubble);
  const detent = useStudy((s) => s.detent);
  const { progress, mounted } = usePresence(chatOpen, motion.chat);
  const kb = useKeyboardHeight();
  const suggestions = useSuggestions(api.passage, api.range, api.hasProvider);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Ao começar uma pergunta nova, rola até ela (o início da resposta fica à vista, como numa leitura).
  const scrollTo = useRef<string | null>(null);
  const seen = useRef(thread0Count());

  const rangeText = api.range ? formatShortRef(api.range.start, api.range.end, books, true) : null;

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
          bottom: kb > 0 ? kb + 8 : 8,
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
          thread.map((t) => <TurnView key={t.id} turn={t} api={api} onAsk={send} onLayoutY={onTurnLayout} />)
        )}
        {api.contextBusy && thread.length > 0 ? <Txt v="meta" color="muted">{CHAT.contextLoading}</Txt> : null}
        {api.passage.error && !api.passage.context ? <Txt v="meta" color="danger">{CHAT.contextError}</Txt> : null}
        {noProvider && thread.length > 0 ? (
          <LinkButton testID="chat-configure" label={CHAT.configure} onPress={() => { closeChat(); router.push('/settings'); }} />
        ) : null}
      </ScrollView>

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
        bottomPad={10 + (kb > 0 ? 0 : metrics.insetBottom)}
      />
    </Animated.View>
  );
}

