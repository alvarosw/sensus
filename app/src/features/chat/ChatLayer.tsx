// Bolinha flutuante + chat sobre a tela (acima da folha de estudo; abaixo de prévia e painéis).
import { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bubble } from './Bubble';
import { ChatPanel } from './ChatPanel';
import { useChat, usePendingQuestion } from './useChat';
import type { Metrics } from './geometry';

export function ChatLayer() {
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState('');

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
    <View pointerEvents="box-none" onLayout={onLayout} style={[StyleSheet.absoluteFill, { zIndex: 11 }]}>
      {box.width > 0 ? (
        <>
          <ChatPanel metrics={metrics} api={api} draft={draft} setDraft={setDraft} send={send} />
          <Bubble metrics={metrics} />
        </>
      ) : null}
    </View>
  );
}
