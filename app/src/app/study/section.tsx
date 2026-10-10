import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  buildCiteIndex,
  buildPanel,
  formatReference,
  parseStructuredAnswer,
  SECTION_KEYS,
  SECTION_LABELS,
  SECTION_LAYER,
  sectionMessages,
  serializePanel,
  CHAT_MAX_TOKENS,
  type PanelData,
  type RichTextContext,
  type SectionKey,
  type SerializedContext,
  type VerseRange,
} from '@sensus/core';
import { streamChat } from '@/ai/client';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { APP_LOCALE, t } from '@/i18n';
import { LayerContent } from '@/features/panel-sections';
import { QuestionChips, RichText } from '@/features/rich-text';
import { SheetProvider } from '@/features/sheets';
import { useSettings } from '@/settings/settings-context';
import { Button, Card, Heading } from '@/ui/primitives';
import { Skeleton } from '@/ui/skeleton';
import { ErrorView, LoadingView } from '@/ui/state';
import { Body, Meta } from '@/ui/text';

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Aprofundamento de uma seção: texto detalhado em streaming, fontes da camada e perguntas de seguimento. */
export default function SectionScreen() {
  const params = useLocalSearchParams<{ key: string; start: string; end: string }>();
  const sectionKey = (SECTION_KEYS as readonly string[]).includes(params.key) ? (params.key as SectionKey) : null;
  const range: VerseRange = useMemo(
    () => ({ start: Number(params.start), end: Number(params.end) }),
    [params.start, params.end],
  );

  const repo = useRepo();
  const { provider } = useSettings();
  const books = useAsync(() => repo.books(), [repo]);
  const panelState = useAsync<PanelData>(() => buildPanel(repo, range), [repo, range.start, range.end]);
  const panel = panelState.data;

  const context: SerializedContext | null = useMemo(() => (panel ? serializePanel(panel) : null), [panel]);
  const rtCtx: RichTextContext | null = useMemo(
    () =>
      context && panel && books.data
        ? { citeIds: context.citeIds, citeIndex: buildCiteIndex(panel, books.data), tokens: panel.layers.text.original }
        : null,
    [context, panel, books.data],
  );

  const [raw, setRaw] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!provider || !context || !sectionKey) return;
    const controller = new AbortController();
    setRaw('');
    setDone(false);
    setError(null);
    streamChat(
      provider,
      sectionMessages(context, sectionKey, { language: APP_LOCALE }),
      (chunk) => setRaw((prev) => prev + chunk),
      controller.signal,
      CHAT_MAX_TOKENS,
    ).then(
      () => {
        if (!controller.signal.aborted) setDone(true);
      },
      (e: unknown) => {
        if (!controller.signal.aborted) setError(messageOf(e));
      },
    );
    return () => controller.abort();
  }, [provider, context, sectionKey]);

  if (!sectionKey) {
    return <ErrorView message={t('common.error')} />;
  }
  if (panelState.loading || books.loading) return <LoadingView message={t('study.panelLoading')} />;
  if (panelState.error || !panel || !rtCtx) {
    return <ErrorView message={t('study.panelError')} detail={panelState.error} onRetry={panelState.reload} />;
  }

  const parsed = raw && rtCtx ? parseStructuredAnswer(raw, rtCtx) : null;
  const reference = formatReference(range, books.data ?? []);
  const layer = SECTION_LAYER[sectionKey];

  return (
    <SheetProvider>
      <Stack.Screen options={{ title: SECTION_LABELS[sectionKey] }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} contentInsetAdjustmentBehavior="automatic">
        <Card style={{ gap: 14 }}>
          <Meta>{reference}</Meta>
          <Heading level={1}>{SECTION_LABELS[sectionKey]}</Heading>
          {!provider ? (
            <View style={{ gap: 10 }}>
              <Body>{t('study.noProvider')}</Body>
              <Button label={t('study.configure')} variant="secondary" onPress={() => router.push('/settings')} />
            </View>
          ) : error ? (
            <Body>{t('study.summaryError', { message: error })}</Body>
          ) : parsed && parsed.blocks.length > 0 ? (
            <RichText blocks={parsed.blocks} index={rtCtx.citeIndex} />
          ) : (
            <Skeleton lines={5} />
          )}
          {parsed && parsed.followUps.length > 0 && done ? (
            <View style={{ gap: 8 }}>
              <Meta>{t('study.followUps')}</Meta>
              <QuestionChips
                questions={parsed.followUps}
                onAsk={(question) =>
                  router.push({
                    pathname: '/study',
                    params: { start: String(range.start), end: String(range.end), ask: question },
                  })
                }
              />
            </View>
          ) : null}
        </Card>

        {layer ? (
          <Card style={{ gap: 12 }}>
            <Heading level={3}>{t('study.sources')}</Heading>
            <LayerContent layer={layer} panel={panel} books={books.data ?? []} />
          </Card>
        ) : null}

      </ScrollView>
    </SheetProvider>
  );
}
