import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import type { Book } from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { BookTileGrid } from '@/ui/book-list';
import { ErrorView, LoadingView } from '@/ui/state';
import { t } from '@/i18n';
import { ChapterSheet } from '@/features/nav/ChapterSheet';
import { ContinueCard } from '@/features/nav/ContinueCard';
import { ReferenceSearch } from '@/features/nav/ReferenceSearch';
import { Segmented } from '@/features/nav/Segmented';
import { useLastPosition } from '@/features/nav/last-position';
import type { RefMatch } from '@/features/nav/reference';
import { NAV } from '@/features/nav/strings';
import { openReaderAt, openStudy } from '@/features/nav/routes';

export default function HomeScreen() {
  const repo = useRepo();
  const books = useAsync(() => repo.books(), [repo]);
  const last = useLastPosition();

  const [testament, setTestament] = useState<'OT' | 'NT'>('OT');
  const [query, setQuery] = useState('');
  const [sheetBook, setSheetBook] = useState<Book | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Abre na aba do testamento da última leitura, uma vez por sessão.
  const testamentSet = useRef(false);
  useEffect(() => {
    if (testamentSet.current || !last || !books.data) return;
    testamentSet.current = true;
    const b = books.data.find((x) => x.num === last.book);
    if (b) setTestament(b.testament);
  }, [last, books.data]);

  if (books.loading) return <LoadingView />;
  if (books.error) {
    return <ErrorView message={t('common.error')} detail={books.error} onRetry={books.reload} />;
  }

  const all = books.data ?? [];
  const lastBook = last ? all.find((b) => b.num === last.book) : undefined;

  function openBook(book: Book) {
    setSheetBook(book);
    setSheetOpen(true);
  }

  function openRef(match: RefMatch, target: 'reader' | 'study') {
    if (target === 'study') {
      openStudy(match.range);
      return;
    }
    openReaderAt(match.book.num, match.chapter, match.verse ?? undefined, match.verseEnd ?? undefined);
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {last && lastBook ? (
        <ContinueCard
          position={last}
          book={lastBook}
          onPress={() => openReaderAt(last.book, last.chapter, last.verse)}
        />
      ) : null}

      <ReferenceSearch
        books={all}
        query={query}
        onQueryChange={setQuery}
        onOpenRef={openRef}
        onPickBook={openBook}
      />

      {query.trim() === '' ? (
        <>
          <Segmented<'OT' | 'NT'>
            accessibilityLabel={NAV.chooseBook}
            value={testament}
            onChange={setTestament}
            options={[
              { value: 'OT', label: NAV.testamentOT },
              { value: 'NT', label: NAV.testamentNT },
            ]}
          />
          <BookTileGrid books={all} testament={testament} onPick={openBook} />
        </>
      ) : null}

      <ChapterSheet
        visible={sheetOpen}
        books={all}
        initialBook={sheetBook}
        onPick={(book, chapter) => {
          setSheetOpen(false);
          openReaderAt(book.num, chapter);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </ScrollView>
  );
}
