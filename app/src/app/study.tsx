import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  buildPanel,
  chatMessages,
  CitationStream,
  formatReference,
  parseCited,
  serializePanel,
  summaryMessages,
  type ChatMessage,
  type CitedSegment,
  type PanelData,
  type SerializedContext,
  type VerseRange,
} from '@sensus/core';
import { streamChat } from '@/ai/client';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { APP_LOCALE, t } from '@/i18n';
import { CitedText } from '@/features/cited-text';
import { PanelSections } from '@/features/panel-sections';
import { useSettings } from '@/settings/settings-context';
import { Button, Card, CollapsibleSection, Heading, Muted } from '@/ui/primitives';
import { ErrorView, LoadingView } from '@/ui/state';
import { Body, Meta } from '@/ui/text';
import { useTheme } from '@/ui/theme';

type SummaryStatus = 'idle' | 'streaming' | 'done' | 'error';

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export default function StudyScreen() {
  const params = useLocalSearchParams<{ start: string; end: string }>();
  const range: VerseRange = useMemo(
    () => ({ start: Number(params.start), end: Number(params.end) }),
    [params.start, params.end],
  );

  const repo = useRepo();
  const theme = useTheme();
  const { provider } = useSettings();

  const books = useAsync(() => repo.books(), [repo]);
  const panelState = useAsync<PanelData>(() => buildPanel(repo, range), [repo, range.start, range.end]);

  const panel = panelState.data;
  const context: SerializedContext | null = useMemo(
    () => (panel ? serializePanel(panel) : null),
    [panel],
  );
  const reference = panel?.reference ?? (books.data ? formatReference(range, books.data) : '');
  const titleOf = (sourceId: string) => panel?.sources[sourceId]?.title;

  // ---- resumo (streaming com citações) -------------------------------------
  const [summarySegments, setSummarySegments] = useState<CitedSegment[]>([]);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>('idle');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summaryAbort = useRef<AbortController | null>(null);

  // ---- chat (somente em memória) ------------------------------------------
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<{ question: string; segments: CitedSegment[] } | null>(null);
  const [draft, setDraft] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const chatAbort = useRef<AbortController | null>(null);

  // Trocar o trecho invalida resumo e conversa anteriores.
  useEffect(() => {
    summaryAbort.current?.abort();
    chatAbort.current?.abort();
    setSummarySegments([]);
    setSummaryStatus('idle');
    setSummaryError(null);
    setHistory([]);
    setPending(null);
    setChatError(null);
    return () => {
      summaryAbort.current?.abort();
      chatAbort.current?.abort();
    };
  }, [range.start, range.end]);

  const generate = useCallback(async () => {
    if (!provider || !context) return;
    summaryAbort.current?.abort();
    const controller = new AbortController();
    summaryAbort.current = controller;
    const stream = new CitationStream(context.citeIds);
    setSummarySegments([]);
    setSummaryError(null);
    setSummaryStatus('streaming');
    try {
      await streamChat(
        provider,
        summaryMessages(context, { language: APP_LOCALE }),
        (chunk) => setSummarySegments(stream.push(chunk)),
        controller.signal,
      );
      setSummarySegments(stream.finish());
      setSummaryStatus('done');
    } catch (e) {
      setSummarySegments(stream.finish());
      if (controller.signal.aborted) {
        setSummaryStatus('done');
        return;
      }
      setSummaryError(messageOf(e));
      setSummaryStatus('error');
    }
  }, [provider, context]);

  const send = useCallback(async () => {
    const question = draft.trim();
    if (!question || !provider || !context || pending) return;
    const controller = new AbortController();
    chatAbort.current = controller;
    const stream = new CitationStream(context.citeIds);
    setDraft('');
    setChatError(null);
    setPending({ question, segments: [] });
    try {
      await streamChat(
        provider,
        chatMessages(context, history, question, { language: APP_LOCALE }),
        (chunk) => setPending({ question, segments: stream.push(chunk) }),
        controller.signal,
      );
      const reply = stream.text;
      setHistory((h) => [
        ...h,
        { role: 'user', content: question },
        { role: 'assistant', content: reply },
      ]);
    } catch (e) {
      if (!controller.signal.aborted) {
        setDraft(question);
        setChatError(messageOf(e));
      }
    } finally {
      setPending(null);
    }
  }, [draft, provider, context, pending, history]);

  // ---- estados de carregamento ---------------------------------------------
  if (panelState.loading || books.loading) {
    return (
      <>
        <Stack.Screen options={{ title: t('study.title') }} />
        <LoadingView message={t('study.panelLoading')} />
      </>
    );
  }
  if (panelState.error || !panel) {
    return (
      <>
        <Stack.Screen options={{ title: t('study.title') }} />
        <ErrorView message={t('study.panelError')} detail={panelState.error} onRetry={panelState.reload} />
      </>
    );
  }

  const hasProvider = provider !== null;
  const citeIds = context?.citeIds ?? new Set<string>();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: reference || t('study.title') }} />

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <Meta>{t('source.reference')}</Meta>
          <Heading level={1}>{reference}</Heading>
        </Card>

        <Card style={{ gap: 12 }}>
          <Heading>{t('study.summaryTitle')}</Heading>
          <Muted>{t('study.summaryHint')}</Muted>

          {!hasProvider ? (
            <View style={{ gap: 10 }}>
              <Body>{t('study.noProvider')}</Body>
              <Button label={t('study.configure')} variant="secondary" onPress={() => router.push('/settings')} />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {summaryStatus === 'streaming' ? (
                <Button label={t('study.stop')} variant="secondary" onPress={() => summaryAbort.current?.abort()} />
              ) : (
                <Button
                  label={summaryStatus === 'done' ? t('study.regenerate') : t('study.generate')}
                  onPress={generate}
                />
              )}
              {summaryStatus === 'streaming' && summarySegments.length === 0 ? (
                <Meta>{t('study.generating')}</Meta>
              ) : null}
              {summaryStatus === 'error' && summaryError ? (
                <Text style={{ color: theme.danger, fontSize: 14 }}>
                  {t('study.summaryError', { message: summaryError })}
                </Text>
              ) : null}
              {summarySegments.length > 0 ? <CitedText segments={summarySegments} titleOf={titleOf} /> : null}
            </View>
          )}
        </Card>

        <PanelSections panel={panel} books={books.data ?? []} />

        <CollapsibleSection
          title={t('study.chatTitle')}
          count={history.length / 2}
          defaultOpen={history.length > 0}
        >
          {history.length === 0 && pending === null ? <Muted>{t('study.chatEmpty')}</Muted> : null}
          {history.map((m, i) =>
            m.role === 'user' ? (
              <View key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
                <View style={{ backgroundColor: theme.selected, borderRadius: 12, padding: 10 }}>
                  <Body>{m.content}</Body>
                </View>
              </View>
            ) : (
              <View key={i} style={{ gap: 4 }}>
                <Meta>{t('study.chatAi')}</Meta>
                <CitedText segments={parseCited(m.content, citeIds)} titleOf={titleOf} />
              </View>
            ),
          )}
          {pending !== null ? (
            <View style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
              <View style={{ backgroundColor: theme.selected, borderRadius: 12, padding: 10 }}>
                <Body>{pending.question}</Body>
              </View>
            </View>
          ) : null}
          {pending !== null ? (
            <View style={{ gap: 4 }}>
              <Meta>{t('study.chatAi')}</Meta>
              {pending.segments.length > 0 ? (
                <CitedText segments={pending.segments} titleOf={titleOf} />
              ) : (
                <Meta>{t('study.generating')}</Meta>
              )}
            </View>
          ) : null}
          {chatError ? (
            <Text style={{ color: theme.danger, fontSize: 14 }}>{t('study.chatError', { message: chatError })}</Text>
          ) : null}
        </CollapsibleSection>
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        style={{ backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            editable={hasProvider && pending === null}
            placeholder={hasProvider ? t('study.chatPlaceholder') : t('study.noProvider')}
            placeholderTextColor={theme.textMuted}
            multiline
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: 44,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: theme.text,
              backgroundColor: theme.bg,
              fontSize: 15,
            }}
          />
          <View style={{ width: 96 }}>
            <Button
              label={t('study.chatSend')}
              onPress={send}
              disabled={!draft.trim() || !hasProvider || pending !== null}
            />
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
