import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View, type LayoutRectangle, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chapterRange, type Book, type TextDivision, type VerseText, type Vid } from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { t } from '@/i18n';
import { shortRef } from '@/features/nav/abbrev';
import { ChapterSheet } from '@/features/nav/ChapterSheet';
import { ReadingBlock } from '@/features/nav/ReadingBlock';
import { writeLastPosition } from '@/features/nav/last-position';
import { openStudy } from '@/features/nav/routes';
import { NAV } from '@/features/nav/strings';
import { buildFlow, verseFraction } from '@/features/nav/verse-flow';
import { Button, Chip } from '@/ui/primitives';
import { Body, Label, Meta } from '@/ui/text';
import { ErrorView, LoadingView } from '@/ui/state';
import { useTheme } from '@/ui/theme';

/** Fonte de texto usada quando nenhuma é escolhida. */
const DEFAULT_TEXT_SOURCE = 'blivre';
/** Tempo do destaque ao abrir por referência. */
const FLASH_MS = 1800;
/** Espaço reservado acima do texto para o alvo não ficar sob o cabeçalho. */
const TARGET_TOP_GAP = 120;

interface Selection {
  key: string;
  start: Vid;
  end: Vid;
}

interface ChapterData {
  verses: VerseText[];
  divisions: TextDivision[];
}

interface ChapterStop {
  book: Book;
  chapter: number;
}

export default function ReaderScreen() {
  const params = useLocalSearchParams<{ book: string; chapter: string; verse?: string; verseEnd?: string }>();
  const bookNum = Number(params.book);
  const chapterNum = Number(params.chapter);
  const targetVerse = params.verse ? Number(params.verse) : null;
  const targetEnd = params.verseEnd ? Number(params.verseEnd) : null;
  const chapterKey = `${bookNum}:${chapterNum}`;
  const targetVid: Vid | null =
    targetVerse !== null && Number.isInteger(targetVerse) ? bookNum * 1_000_000 + chapterNum * 1000 + targetVerse : null;
  const targetEndVid: Vid | null =
    targetEnd !== null && Number.isInteger(targetEnd) ? bookNum * 1_000_000 + chapterNum * 1000 + targetEnd : null;

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

  const chapterData = useAsync<ChapterData>(async () => {
    if (!activeSourceId) return { verses: [], divisions: [] };
    const [verses, divisions] = await Promise.all([
      repo.chapter(activeSourceId, bookNum, chapterNum),
      repo.divisions(activeSourceId, chapterRange(bookNum, chapterNum)),
    ]);
    const chapterPrefix = bookNum * 1000 + chapterNum;
    return {
      // Versículo 0 é introdução do capítulo; não entra no fluxo de leitura.
      verses: verses.filter((v) => v.vid % 1000 !== 0),
      divisions: divisions.filter((d) => Math.floor(d.vid / 1000) === chapterPrefix),
    };
  }, [repo, activeSourceId, bookNum, chapterNum]);

  const blocks = useMemo(
    () => buildFlow(chapterData.data?.verses ?? [], chapterData.data?.divisions ?? []),
    [chapterData.data],
  );

  // ---- seleção de versículos ------------------------------------------------
  const [selection, setSelection] = useState<Selection | null>(null);
  const current = selection?.key === chapterKey ? selection : null;
  const selStart = current?.start ?? null;
  const selEnd = current?.end ?? null;
  const selectionRange = useMemo(
    () => (selStart !== null && selEnd !== null ? { start: selStart, end: selEnd } : null),
    [selStart, selEnd],
  );

  const onVersePress = useCallback(
    (vid: Vid) => {
      setSelection((prev) => {
        const cur = prev && prev.key === chapterKey ? prev : null;
        if (!cur) return { key: chapterKey, start: vid, end: vid };
        // Tocar em versículo já selecionado desfaz a seleção.
        if (vid >= cur.start && vid <= cur.end) return null;
        // Tocar em outro versículo estende o intervalo até ele.
        return { key: chapterKey, start: Math.min(cur.start, vid), end: Math.max(cur.end, vid) };
      });
    },
    [chapterKey],
  );

  // ---- destaque e rolagem até o versículo alvo -----------------------------
  const [flash, setFlash] = useState<{ start: Vid; end: Vid } | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const layouts = useRef(new Map<string, LayoutRectangle>());
  const scrollRef = useRef<ScrollView>(null);
  const scrolledFor = useRef<string | null>(null);

  const targetBlockKey =
    targetVid === null
      ? null
      : (blocks.find((b) => b.kind === 'paragraph' && b.verses.some((v) => v.vid === targetVid))?.key ?? null);
  const targetBlockRef = useRef<string | null>(null);
  targetBlockRef.current = targetBlockKey;
  const targetToken = targetVid === null ? null : `${chapterKey}:${targetVid}:${targetEndVid ?? ''}`;

  const onBlockLayout = useCallback((key: string, layout: LayoutRectangle) => {
    layouts.current.set(key, layout);
    if (key === targetBlockRef.current) setLayoutTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!targetToken || targetVid === null || !targetBlockKey || scrolledFor.current === targetToken) return;
    const layout = layouts.current.get(targetBlockKey);
    const block = blocks.find((b) => b.key === targetBlockKey);
    if (!layout || !block) return;
    scrolledFor.current = targetToken;
    const y = layout.y + verseFraction(block, targetVid) * layout.height - TARGET_TOP_GAP;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
    setFlash({ start: targetVid, end: targetEndVid ?? targetVid });
  }, [targetToken, targetVid, targetEndVid, targetBlockKey, blocks, layoutTick]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(id);
  }, [flash]);

  // Trocar de capítulo volta ao topo (a primeira renderização não rola).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [chapterKey]);

  // ---- última posição -------------------------------------------------------
  useEffect(() => {
    if (!Number.isInteger(bookNum) || !Number.isInteger(chapterNum) || bookNum < 1 || chapterNum < 1) return;
    writeLastPosition({
      book: bookNum,
      chapter: chapterNum,
      ...(targetVerse && Number.isInteger(targetVerse) ? { verse: targetVerse } : {}),
    });
  }, [bookNum, chapterNum, targetVerse]);

  // ---- navegação entre capítulos -------------------------------------------
  const book = books.data?.find((b) => b.num === bookNum);
  const bookName = book?.name_pt ?? '';
  const title = bookName ? `${bookName} ${chapterNum}` : t('reader.title');

  const neighbors = useMemo((): { prev: ChapterStop | null; next: ChapterStop | null } => {
    const list = books.data ?? [];
    const cur = list.find((b) => b.num === bookNum);
    if (!cur) return { prev: null, next: null };
    let prev: ChapterStop | null = null;
    let next: ChapterStop | null = null;
    if (chapterNum > 1) {
      prev = { book: cur, chapter: chapterNum - 1 };
    } else {
      const before = list.find((b) => b.num === bookNum - 1);
      if (before) prev = { book: before, chapter: before.chapters };
    }
    if (chapterNum < cur.chapters) {
      next = { book: cur, chapter: chapterNum + 1 };
    } else {
      const after = list.find((b) => b.num === bookNum + 1);
      if (after) next = { book: after, chapter: 1 };
    }
    return { prev, next };
  }, [books.data, bookNum, chapterNum]);

  const goTo = useCallback((b: number, c: number) => {
    setSelection(null);
    router.setParams({ book: String(b), chapter: String(c), verse: '', verseEnd: '' });
  }, []);

  // Deslizar horizontalmente troca de capítulo; gestos mais verticais são da rolagem.
  const navRef = useRef(neighbors);
  navRef.current = neighbors;
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > 2.2 * Math.abs(g.dy),
        onPanResponderRelease: (_e, g) => {
          const { prev, next } = navRef.current;
          if (g.dx < -60 && next) goTo(next.book.num, next.chapter);
          else if (g.dx > 60 && prev) goTo(prev.book.num, prev.chapter);
        },
      }),
    [goTo],
  );

  const [pickerOpen, setPickerOpen] = useState(false);

  // ---- estados de carregamento ---------------------------------------------
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

  const verses = chapterData.data?.verses ?? [];
  const selectionLabel = current ? shortRef({ start: current.start, end: current.end }) : '';

  return (
    <View style={{ flex: 1 }} {...swipe.panHandlers}>
      <Stack.Screen
        options={{
          title,
          headerTitle: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${NAV.chooseBook}`}
              onPress={() => setPickerOpen(true)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Text numberOfLines={1} style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
                {title}
              </Text>
              <Text style={{ color: theme.accent, fontSize: 13 }}>▾</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: (current ? 210 : 150) + insets.bottom }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={{ paddingHorizontal: 22, paddingTop: 14 }}>
          {textSources.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              {textSources.map((s) => (
                <Chip key={s.id} label={s.title} selected={s.id === activeSourceId} onPress={() => setPickedSource(s.id)} />
              ))}
            </ScrollView>
          ) : null}

          <Label>{NAV.chapterLabel(chapterNum)}</Label>
          <View style={{ height: 6 }} />
          <Meta>{t('reader.hint')}</Meta>

          {chapterData.loading ? <LoadingView /> : null}
          {chapterData.error ? (
            <ErrorView message={t('common.error')} detail={chapterData.error} onRetry={chapterData.reload} />
          ) : null}
          {!chapterData.loading && !chapterData.error && verses.length === 0 ? (
            <View style={{ paddingTop: 16 }}>
              <Body>{activeSourceId ? t('reader.noVerses') : t('common.noSource')}</Body>
            </View>
          ) : null}

          <View style={{ paddingTop: 4 }}>
            {blocks.map((block) => (
              <ReadingBlock
                key={block.key}
                block={block}
                selection={selectionRange}
                flash={flash}
                onVersePress={onVersePress}
                onLayout={onBlockLayout}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 10 + insets.bottom,
          gap: 10,
        }}
      >
        {current ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label={t('reader.clear')} onPress={() => setSelection(null)} />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                label={NAV.study(selectionLabel)}
                onPress={() => openStudy({ start: current.start, end: current.end })}
              />
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ChapterStep
            direction="prev"
            target={neighbors.prev}
            onPress={() => neighbors.prev && goTo(neighbors.prev.book.num, neighbors.prev.chapter)}
          />
          <ChapterStep
            direction="next"
            target={neighbors.next}
            onPress={() => neighbors.next && goTo(neighbors.next.book.num, neighbors.next.chapter)}
          />
        </View>
      </View>

      <ChapterSheet
        visible={pickerOpen}
        books={books.data ?? []}
        initialBook={book ?? null}
        currentBook={bookNum}
        currentChapter={chapterNum}
        onPick={(b, c) => {
          setPickerOpen(false);
          goTo(b.num, c);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

function ChapterStep({
  direction,
  target,
  onPress,
}: {
  direction: 'prev' | 'next';
  target: ChapterStop | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const prev = direction === 'prev';
  const name = target ? `${target.book.name_pt} ${target.chapter}` : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={target ? `${prev ? NAV.prevChapter : NAV.nextChapter}: ${name}` : undefined}
      accessibilityState={{ disabled: !target }}
      disabled={!target}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: prev ? 'flex-start' : 'flex-end',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: theme.chip,
        opacity: !target ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      {prev ? <Text style={{ color: theme.accent, fontSize: 20, fontWeight: '600' }}>‹</Text> : null}
      <View style={{ flexShrink: 1, alignItems: prev ? 'flex-start' : 'flex-end' }}>
        <Meta>{prev ? NAV.prevChapter : NAV.nextChapter}</Meta>
        <Text numberOfLines={1} style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
          {name || '—'}
        </Text>
      </View>
      {!prev ? <Text style={{ color: theme.accent, fontSize: 20, fontWeight: '600' }}>›</Text> : null}
    </Pressable>
  );
}
