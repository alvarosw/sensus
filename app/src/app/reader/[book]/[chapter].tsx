import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatReference, type VerseText, type Vid } from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { t } from '@/i18n';
import { Body, Meta } from '@/ui/text';
import { Button, Chip } from '@/ui/primitives';
import { readingFont, useTheme } from '@/ui/theme';
import { ErrorView, LoadingView } from '@/ui/state';

/** Fonte de texto usada quando nenhuma é escolhida. */
const DEFAULT_TEXT_SOURCE = 'blivre';

interface Selection {
  key: string;
  start: Vid;
  end: Vid;
}

export default function ReaderScreen() {
  const { book, chapter } = useLocalSearchParams<{ book: string; chapter: string }>();
  const bookNum = Number(book);
  const chapterNum = Number(chapter);
  const selectionKey = `${bookNum}:${chapterNum}`;

  const repo = useRepo();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const books = useAsync(() => repo.books(), [repo]);
  const sources = useAsync(() => repo.sources(), [repo]);
  const textSources = (sources.data ?? []).filter((s) => s.kind === 'text');

  const [pickedSource, setPickedSource] = useState<string | null>(null);
  const activeSource =
    textSources.find((s) => s.id === pickedSource) ??
    textSources.find((s) => s.id === DEFAULT_TEXT_SOURCE) ??
    textSources[0];
  const activeSourceId = activeSource?.id ?? null;

  const verses = useAsync<VerseText[]>(
    () => (activeSourceId ? repo.chapter(activeSourceId, bookNum, chapterNum) : Promise.resolve([])),
    [repo, activeSourceId, bookNum, chapterNum],
  );

  const [selection, setSelection] = useState<Selection | null>(null);
  const current = selection?.key === selectionKey ? selection : null;

  function onVersePress(vid: Vid) {
    if (!current) {
      setSelection({ key: selectionKey, start: vid, end: vid });
      return;
    }
    if (vid >= current.start && vid <= current.end) {
      // Tocar em versículo já selecionado desfaz a seleção.
      setSelection(null);
      return;
    }
    // Tocar em outro versículo estende o intervalo até ele.
    setSelection({
      key: selectionKey,
      start: Math.min(current.start, vid),
      end: Math.max(current.end, vid),
    });
  }

  const bookName = books.data?.find((b) => b.num === bookNum)?.name_pt ?? '';
  const title = bookName ? `${bookName} ${chapterNum}` : t('reader.title');

  const reference =
    current && books.data ? formatReference({ start: current.start, end: current.end }, books.data) : '';

  if (books.loading || sources.loading) return <LoadingView />;
  if (books.error || sources.error) {
    return (
      <ErrorView
        message={t('common.error')}
        detail={books.error ?? sources.error}
        onRetry={() => {
          books.reload();
          sources.reload();
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title }} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 140 + insets.bottom, gap: 14 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {textSources.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {textSources.map((s) => (
              <Chip
                key={s.id}
                label={s.title}
                selected={s.id === activeSourceId}
                onPress={() => setPickedSource(s.id)}
              />
            ))}
          </ScrollView>
        ) : null}

        <Meta>{t('reader.hint')}</Meta>

        {verses.loading ? <LoadingView /> : null}
        {verses.error ? (
          <ErrorView message={t('common.error')} detail={verses.error} onRetry={verses.reload} />
        ) : null}
        {!verses.loading && !verses.error && (verses.data ?? []).length === 0 ? (
          <Body>{activeSourceId ? t('reader.noVerses') : t('common.noSource')}</Body>
        ) : null}

        {(verses.data ?? []).map((verse) => {
          const selected = current !== null && verse.vid >= current.start && verse.vid <= current.end;
          return (
            <Pressable
              key={verse.cite_id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onVersePress(verse.vid)}
              style={{
                flexDirection: 'row',
                gap: 10,
                paddingVertical: 6,
                paddingHorizontal: 8,
                borderRadius: 10,
                backgroundColor: selected ? theme.selected : 'transparent',
              }}
            >
              <Text
                style={{
                  color: theme.accent,
                  fontSize: 12,
                  fontWeight: '700',
                  minWidth: 22,
                  paddingTop: 6,
                  textAlign: 'right',
                }}
              >
                {verse.vid % 1000}
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: theme.text,
                  fontSize: 17,
                  lineHeight: 26,
                  fontFamily: readingFont,
                }}
              >
                {verse.text}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {current ? (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 16 + insets.bottom,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              label={t('reader.study', { reference })}
              onPress={() =>
                router.push({
                  pathname: '/study',
                  params: { start: String(current.start), end: String(current.end) },
                })
              }
            />
          </View>
          <Button label={t('reader.clear')} variant="secondary" onPress={() => setSelection(null)} />
        </View>
      ) : null}
    </View>
  );
}
