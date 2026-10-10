import { useMemo } from 'react';
import { t } from '@/i18n';
import { View } from 'react-native';
import { parseStructuredAnswer, type CiteIndex, type RichTextContext } from '@sensus/core';
import { Card } from '@/ui/primitives';
import { Skeleton } from '@/ui/skeleton';
import { Body, Meta } from '@/ui/text';
import { useTheme } from '@/ui/theme';
import { QuestionChips, RichText } from './rich-text';

/** Uma pergunta e sua resposta em streaming (ou completa), com perguntas de seguimento. */
export function AnswerCard({
  question,
  raw,
  rtCtx,
  onAsk,
  disabled,
}: {
  question: string;
  raw: string;
  rtCtx: RichTextContext;
  onAsk: (question: string) => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  const parsed = useMemo(() => parseStructuredAnswer(raw, rtCtx), [raw, rtCtx]);
  const index: CiteIndex = rtCtx.citeIndex;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
        <View style={{ backgroundColor: theme.selected, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 }}>
          <Body>{question}</Body>
        </View>
      </View>
      <Card style={{ gap: 14 }}>
        {raw.length === 0 ? (
          <Skeleton lines={4} />
        ) : parsed.blocks.length > 0 ? (
          <RichText blocks={parsed.blocks} index={index} />
        ) : (
          <Meta>{question}</Meta>
        )}
        {parsed.followUps.length > 0 && parsed.complete ? (
          <View style={{ gap: 8 }}>
            <Meta>{t('study.followUps')}</Meta>
            <QuestionChips questions={parsed.followUps} onAsk={onAsk} disabled={disabled} />
          </View>
        ) : null}
      </Card>
    </View>
  );
}
