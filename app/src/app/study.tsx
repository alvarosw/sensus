import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  buildCiteIndex,
  buildPanel,
  formatReference,
  parseStructuredSummary,
  SECTION_KEYS,
  serializePanel,
  summaryMessages,
  answerMessages,
  SUMMARY_MAX_TOKENS,
  CHAT_MAX_TOKENS,
  type ChatMessage,
  type PanelData,
  type RichTextContext,
  type SerializedContext,
  type VerseRange,
} from '@sensus/core';
import { streamChat } from '@/ai/client';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { APP_LOCALE, t } from '@/i18n';
import { AnswerCard } from '@/features/thread';
import { PassageCard } from '@/features/passage';
import { QuestionChips, RichText } from '@/features/rich-text';
import { SectionCard } from '@/features/section-card';
import { SheetProvider } from '@/features/sheets';
import { useSettings } from '@/settings/settings-context';
import { Button, Card, Heading } from '@/ui/primitives';
import { Skeleton } from '@/ui/skeleton';
import { ErrorView, LoadingView } from '@/ui/state';
import { Body, Meta } from '@/ui/text';
import { useTheme } from '@/ui/theme';

type Status = 'idle' | 'streaming' | 'done' | 'error';

interface Turn {
  question: string;
  raw: string;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export default function StudyScreen() {
  const params = useLocalSearchParams<{ start: string; end: string; ask?: string }>();
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
  const bookList = books.data ?? [];

  const context: SerializedContext | null = useMemo(() => (panel ? serializePanel(panel) : null), [panel]);
  const rtCtx: RichTextContext | null = useMemo(
    () =>
      context && panel && books.data
        ? { citeIds: context.citeIds, citeIndex: buildCiteIndex(panel, books.data), tokens: panel.layers.text.original }
        : null,
    [context, panel, books.data],
  );
  const reference = panel?.reference ?? (books.data ? formatReference(range, books.data) : '');

  // ---- resumo: inicia sozinho ao abrir o estudo ----------------------------------
  const [summaryRaw, setSummaryRaw] = useState('');
  const [summaryStatus, setSummaryStatus] = useState<Status>('idle');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summaryAbort = useRef<AbortController | null>(null);

  const runSummary = useCallback(() => {
    if (!provider || !context) return;
    summaryAbort.current?.abort();
    const controller = new AbortController();
    summaryAbort.current = controller;
    setSummaryRaw('');
    setSummaryError(null);
    setSummaryStatus('streaming');
    streamChat(
      provider,
      summaryMessages(context, { language: APP_LOCALE }),
      (chunk) => setSummaryRaw((prev) => prev + chunk),
      controller.signal,
      SUMMARY_MAX_TOKENS,
    ).then(
      () => {
        if (!controller.signal.aborted) setSummaryStatus('done');
      },
      (e: unknown) => {
        if (controller.signal.aborted) return;
        setSummaryError(messageOf(e));
        setSummaryStatus('error');
      },
    );
  }, [provider, context]);

  useEffect(() => {
    runSummary();
    return () => summaryAbort.current?.abort();
  }, [runSummary]);

  const structured = useMemo(
    () => (rtCtx && summaryRaw ? parseStructuredSummary(summaryRaw, rtCtx) : null),
    [rtCtx, summaryRaw],
  );

  // ---- perguntas: thread em memória ----------------------------------------------
  const [thread, setThread] = useState<Turn[]>([]);
  const [pending, setPending] = useState<Turn | null>(null);
  const [draft, setDraft] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const chatAbort = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Trocar o trecho invalida resumo e conversa anteriores.
  useEffect(() => {
    chatAbort.current?.abort();
    setThread([]);
    setPending(null);
    setChatError(null);
    setDraft('');
    return () => chatAbort.current?.abort();
  }, [range.start, range.end]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || !provider || !context || !rtCtx || pending) return;
      chatAbort.current?.abort();
      const controller = new AbortController();
      chatAbort.current = controller;
      setChatError(null);
      setDraft('');
      setPending({ question: q, raw: '' });
      const history: ChatMessage[] = thread.flatMap((turn) => [
        { role: 'user' as const, content: turn.question },
        { role: 'assistant' as const, content: turn.raw },
      ]);
      let raw = '';
      try {
        await streamChat(
          provider,
          answerMessages(context, history, q, { language: APP_LOCALE }),
          (chunk) => {
            raw += chunk;
            setPending({ question: q, raw });
          },
          controller.signal,
          CHAT_MAX_TOKENS,
        );
        setThread((th) => [...th, { question: q, raw }]);
      } catch (e) {
        if (!controller.signal.aborted) setChatError(messageOf(e));
      } finally {
        setPending(null);
      }
    },
    [provider, context, rtCtx, pending, thread],
  );

  // Pergunta vinda de outra tela (ex.: aprofundamento): envia uma vez ao abrir.
  const autoAsked = useRef<string | null>(null);
  useEffect(() => {
    if (params.ask && rtCtx && provider && autoAsked.current !== params.ask) {
      autoAsked.current = params.ask;
      void ask(params.ask);
    }
  }, [params.ask, rtCtx, provider, ask]);

  // ---- estados de carregamento ---------------------------------------------------
  if (panelState.loading || books.loading) {
    return (
      <>
        <Stack.Screen options={{ title: t('study.title') }} />
        <LoadingView message={t('study.panelLoading')} />
      </>
    );
  }
  if (panelState.error || !panel || !rtCtx) {
    return (
      <>
        <Stack.Screen options={{ title: t('study.title') }} />
        <ErrorView message={t('study.panelError')} detail={panelState.error} onRetry={panelState.reload} />
      </>
    );
  }

  const hasProvider = provider !== null;
  const streaming = summaryStatus === 'streaming';
  const questionsReady = structured !== null && structured.questions.length > 0;

  return (
    <SheetProvider>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Stack.Screen options={{ title: reference || t('study.title') }} />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 18 }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (thread.length > 0 || pending) scrollRef.current?.scrollToEnd({ animated: true });
          }}
        >
          <PassageCard panel={panel} reference={reference} />

          {!hasProvider ? (
            <Card style={{ gap: 10 }}>
              <Heading>{t('study.summaryTitle')}</Heading>
              <Body>{t('study.noProvider')}</Body>
              <Button label={t('study.configure')} variant="secondary" onPress={() => router.push('/settings')} />
            </Card>
          ) : (
            <View style={{ gap: 14 }}>
              <Card style={{ gap: 12 }}>
                <Heading>{t('study.overview')}</Heading>
                {structured && structured.overview.length > 0 ? (
                  <RichText blocks={structured.overview} index={rtCtx.citeIndex} />
                ) : summaryStatus === 'error' ? (
                  <View style={{ gap: 10 }}>
                    <Text style={{ color: theme.danger, fontSize: 14, lineHeight: 20 }}>
                      {t('study.summaryError', { message: summaryError ?? '' })}
                    </Text>
                    <Button label={t('common.retry')} variant="secondary" onPress={runSummary} />
                  </View>
                ) : (
                  <Skeleton lines={3} />
                )}
              </Card>

              {SECTION_KEYS.map((key) => (
                <SectionCard
                  key={key}
                  sectionKey={key}
                  blocks={structured?.sections[key]}
                  streaming={streaming}
                  index={rtCtx.citeIndex}
                  panel={panel}
                  books={bookList}
                  start={range.start}
                  end={range.end}
                />
              ))}

              {questionsReady ? (
                <Card style={{ gap: 12 }}>
                  <Heading level={3}>{t('study.questionsTitle')}</Heading>
                  <QuestionChips questions={structured.questions} onAsk={ask} disabled={pending !== null} />
                </Card>
              ) : null}
            </View>
          )}

          {thread.map((turn, i) => (
            <AnswerCard
              key={i}
              question={turn.question}
              raw={turn.raw}
              rtCtx={rtCtx}
              onAsk={ask}
              disabled={pending !== null}
            />
          ))}
          {pending ? (
            <AnswerCard question={pending.question} raw={pending.raw} rtCtx={rtCtx} onAsk={ask} disabled />
          ) : null}
          {chatError ? (
            <Text style={{ color: theme.danger, fontSize: 14, lineHeight: 20 }}>
              {t('study.chatError', { message: chatError })}
            </Text>
          ) : null}
          {thread.length === 0 && pending === null && hasProvider ? <Meta>{t('study.chatEmpty')}</Meta> : null}
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
              placeholder={hasProvider ? t('study.askPlaceholder') : t('study.noProvider')}
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
              <Button label={t('study.chatSend')} onPress={() => ask(draft)} disabled={!draft.trim() || !hasProvider || pending !== null} />
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SheetProvider>
  );
}
