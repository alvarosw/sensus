import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { t } from '@/i18n';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { openReader } from '@/features/navigation';
import { BookGroup } from '@/ui/book-list';
import { ErrorView, LoadingView } from '@/ui/state';

export default function BooksScreen() {
  const repo = useRepo();
  const books = useAsync(() => repo.books(), [repo]);
  const [openBook, setOpenBook] = useState<number | null>(null);

  if (books.loading) return <LoadingView />;
  if (books.error) {
    return <ErrorView message={t('common.error')} detail={books.error} onRetry={books.reload} />;
  }

  const all = books.data ?? [];
  const ot = all.filter((b) => b.testament === 'OT');
  const nt = all.filter((b) => b.testament === 'NT');

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} contentInsetAdjustmentBehavior="automatic">
      <View style={{ gap: 8 }}>
        <BookGroup
          title={t('books.ot')}
          books={ot}
          openBook={openBook}
          onToggle={setOpenBook}
          onChapter={openReader}
        />
      </View>
      <View style={{ gap: 8 }}>
        <BookGroup
          title={t('books.nt')}
          books={nt}
          openBook={openBook}
          onToggle={setOpenBook}
          onChapter={openReader}
        />
      </View>
    </ScrollView>
  );
}
