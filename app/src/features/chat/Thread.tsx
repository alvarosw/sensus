// Conversa: vez da pergunta (balão à direita, anexos como chips) e resposta (byline SENSUS, RichBlocks, seguimentos).
import { useMemo } from 'react';
import { View } from 'react-native';
import { parseStructuredAnswer } from '@sensus/core';
import { fontFamilies, LinkButton, QuestionButton, radius, Skeleton, Txt, useTheme } from '@/design';
import { useStudy, type ChatTurn } from '@/state/study';
import { RichBlocks } from '../rich/RichBlocks';
import { GreekText } from '../common/GreekText';
import { CHAT } from '../common/strings';
import { turnCtxOf, EMPTY_CTX } from './engine';
import type { ChatApi } from './useChat';

export function TurnView({
  turn,
  api,
  onAsk,
  onLayoutY,
}: {
  turn: ChatTurn;
  api: ChatApi;
  onAsk: (q: string) => void;
  onLayoutY: (id: string, y: number) => void;
}) {
  const { c } = useTheme();
  const ctx = turnCtxOf(turn.id) ?? api.richCtx ?? EMPTY_CTX;
  const parsed = useMemo(() => parseStructuredAnswer(turn.answer, ctx), [turn.answer, ctx]);
  const streaming = turn.status === 'streaming';
  const chip = c.accentText + '2E';
  return (
    <View style={{ gap: 14 }} testID={`turn-${turn.id}`} onLayout={(e) => onLayoutY(turn.id, e.nativeEvent.layout.y)}>
      <View
        style={{
          alignSelf: 'flex-end',
          maxWidth: '88%',
          backgroundColor: c.accent,
          borderRadius: 16,
          borderBottomRightRadius: 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        {turn.attachments.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {turn.attachments.map((a) => (
              <View key={a.id} style={{ backgroundColor: chip, borderRadius: 5, paddingHorizontal: 6 }}>
                <GreekText v="meta" color="accentText" bold style={{ fontSize: 11 }}>{a.label}</GreekText>
              </View>
            ))}
          </View>
        ) : null}
        <Txt v="bodySm" color="accentText" style={{ fontSize: 14, lineHeight: 20 }}>{turn.question}</Txt>
      </View>

      <View style={{ gap: 8 }}>
        <Txt v="eyebrow" color="muted">{CHAT.by}</Txt>
        {turn.answer.length === 0 && streaming ? (
          <View style={{ gap: 8 }} testID={turn.thinking ? 'turn-thinking' : undefined}>
            {turn.thinking ? (
              <Txt v="meta" color="muted" style={{ fontStyle: 'italic' }}>{CHAT.thinking}</Txt>
            ) : null}
            <Skeleton />
            <Skeleton width="90%" />
            <Skeleton width="60%" />
          </View>
        ) : (
          <RichBlocks blocks={parsed.blocks} streaming={streaming} claimKeyPrefix={`ans-${turn.id}`} />
        )}
        {turn.status === 'error' ? (
          <View
            testID="turn-error"
            style={{ backgroundColor: c.warn, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8, gap: 2 }}
          >
            <Txt v="bodySm" color="warnText" style={{ fontFamily: fontFamilies.uiSemibold }}>
              {turn.error === CHAT.interrupted ? turn.error : CHAT.failed(turn.error ?? '')}
            </Txt>
            <View style={{ flexDirection: 'row' }}>
              <LinkButton testID="turn-retry" label={CHAT.retry} onPress={() => api.retry(turn.id)} />
            </View>
          </View>
        ) : null}
        {turn.status === 'done' && parsed.followUps.length > 0 ? (
          <View style={{ gap: 6 }}>
            {parsed.followUps.map((q, i) => (
              <QuestionButton key={`${i}-${q}`} testID={`followup-${i}`} text={q} onPress={() => onAsk(q)} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Quando o motor não é usado (sem resposta em curso), garante que a lista seja reativa ao estado. */
export function useThread(): ChatTurn[] {
  return useStudy((s) => s.thread);
}
