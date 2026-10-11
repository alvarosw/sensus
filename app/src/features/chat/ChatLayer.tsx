// Bolinha flutuante + chat sobre a tela (acima da barra, do leitor, da folha e do seletor; abaixo de prévia e
// painéis). Com o chat aberto, um toque fora dele só fecha o chat: a camada "chat-outside" fica logo abaixo do
// painel e consome o toque (teclado fechado no mesmo toque).
import { useCallback, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudy } from '@/state/study';
import { Bubble } from './Bubble';
import { ChatPanel } from './ChatPanel';
import { useChat, usePendingQuestion } from './useChat';
import type { Metrics } from './geometry';

export function ChatLayer() {
  const insets = useSafeAreaInsets();
  const chatOpen = useStudy((s) => s.chatOpen);
  const closeChat = useStudy((s) => s.closeChat);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState('');

  const onOutside = useCallback(() => {
    Keyboard.dismiss();
    closeChat();
  }, [closeChat]);

  const onNoProvider = useCallback((q: string) => setDraft(q), []);
  const api = useChat(onNoProvider);

  const send = useCallback(
    (q: string) => {
      if (api.ask(q)) setDraft('');
    },
    [api],
  );
  usePendingQuestion(api.hasProvider ? !api.streaming && !api.contextBusy : true, send);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b.width === width && b.height === height ? b : { width, height }));
  }, []);

  const metrics: Metrics = { width: box.width, height: box.height, insetTop: insets.top, insetBottom: insets.bottom };
  return (
    // elevation: no Android a ordem de toque segue a elevação (a folha tem sombra com elevation 16); a camada do
    // chat fica acima dela, e a prévia/painéis (SourceLayer) acima do chat.
    <View pointerEvents="box-none" onLayout={onLayout} style={[StyleSheet.absoluteFill, { zIndex: 11, elevation: 20 }]}>
      {box.width > 0 ? (
        <>
          <View testID="chat-outside-layer" pointerEvents={chatOpen ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
            <Pressable testID="chat-outside" style={StyleSheet.absoluteFill} onPress={onOutside} accessible={false} />
          </View>
          <ChatPanel metrics={metrics} api={api} draft={draft} setDraft={setDraft} send={send} />
          <Bubble metrics={metrics} />
        </>
      ) : null}
    </View>
  );
}
