// Tela de busca por palavra (docs/design/1a-busca.html): campo editável, filtros (Toda a Bíblia, AT, NT e livro) e
// os estados (preparando o índice, sem resultados, sem resultados por causa do filtro, resultados).
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bibleAbbr, type Vid } from '@sensus/core';
import { Icon, IconButton, Segmented, Skeleton, Txt, fontFamilies, radius, space, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { foldText } from '@/data/bibles/search-model';
import { useSearchIndex } from '@/data/bibles/search-index';
import { useBibles } from '@/data/bibles/bibles-store';
import { useAppPrefs } from '@/settings/app-prefs';
import { useStudy } from '@/state/study';
import { useReaderNav } from '@/state/reader-nav';
import { useLang } from '@/i18n/lang-store';
import { BACK_PRIORITY, useBackLayer } from '../common/back';
import { BookFilterSheet } from './BookFilterSheet';
import { SearchResults } from './SearchResults';
import { filterHits, hitBookName, pushRecent, type TestamentFilter } from './search-model';
import { useSearch } from './search-store';
import { SEARCH } from './strings';
import { useSearchResults } from './useSearchResults';

/** Abre a busca com um texto novo e guarda-o nas buscas recentes. */
export function openSearch(query: string): void {
  const prefs = useAppPrefs.getState();
  prefs.setRecentSearches(pushRecent(prefs.recentSearches, query, foldText));
  useSearch.getState().start(query.trim());
  router.push('/search');
}

/** Avisa quando o índice ficar pronto (a pessoa saiu da tela enquanto ele era montado). */
function notifyWhenReady(source: string, bible: string): void {
  const unsub = useSearchIndex.subscribe((s) => {
    const phase = s.byId[source]?.phase;
    if (phase === 'building' || phase === 'missing') return;
    unsub();
    if (phase === 'ready' || phase === 'scan') {
      useStudy.getState().showToast({ text: SEARCH.ready(bible), actionLabel: SEARCH.seeResults, onAction: () => router.push('/search') });
    }
  });
}

export function SearchScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const source = useStudy((s) => s.textSource);
  const catalog = useBibles((s) => s.catalog);
  const bible = bibleAbbr(source, catalog);
  const { query, prefix, testament, book } = useSearch();
  const [draft, setDraft] = useState(query);
  const [booksOpen, setBooksOpen] = useState(false);
  const { view, terms, retry } = useSearchResults(source, query, prefix);

  const leave = () => {
    if (view.kind === 'preparing') notifyWhenReady(source, bible);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  useBackLayer('search-books', booksOpen, () => setBooksOpen(false), BACK_PRIORITY.picker);

  const submit = () => {
    const q = draft.trim();
    if (!q) return;
    const prefs = useAppPrefs.getState();
    prefs.setRecentSearches(pushRecent(prefs.recentSearches, q, foldText));
    useSearch.getState().start(q);
  };

  const openHit = (vid: Vid, list: Vid[]) => {
    useSearch.getState().setNav({ hits: list, index: Math.max(0, list.indexOf(vid)), terms, prefix, query });
    if (router.canGoBack()) router.back();
    else router.replace('/');
    useReaderNav.getState().goVerse(vid, { flash: true });
  };

  const hits = view.kind === 'results' ? view.hits : [];
  const showFilters = view.kind === 'results' || view.kind === 'loading';

  return (
    <View testID="screen-search" style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 6, paddingLeft: 6, paddingRight: 10 }}>
          <IconButton testID="search-back" icon="back" label={SEARCH.back} onPress={leave} />
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[4], height: 40, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, borderRadius: radius.lg, paddingLeft: 10, paddingRight: 4 }}>
            <Icon name="search" size={15} color={c.muted} />
            <TextInput
              testID="search-input"
              accessibilityLabel={SEARCH.wordPlaceholder}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              placeholder={SEARCH.wordPlaceholder}
              placeholderTextColor={c.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{ flex: 1, minWidth: 0, height: '100%', fontFamily: fontFamilies.ui, fontSize: 15, color: c.text }}
            />
            {draft ? (
              <Pressable testID="search-clear" accessibilityRole="button" accessibilityLabel={SEARCH.clear} hitSlop={8} onPress={() => setDraft('')} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={11} color={c.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {/* Espaço reservado da Entrega 1B (grego e hebraico: lema e Strong), entre o campo e os filtros. */}

      {showFilters && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <View style={{ flex: 1 }}>
            <Segmented<TestamentFilter>
              testID="search-testament"
              value={testament}
              onChange={(t) => useSearch.getState().setTestament(t)}
              options={[
                { key: 'all', label: SEARCH.allBible },
                { key: 'OT', label: SEARCH.ot },
                { key: 'NT', label: SEARCH.nt },
              ]}
            />
          </View>
          <Pressable
            testID="search-book"
            accessibilityRole="button"
            onPress={() => setBooksOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], height: 36, maxWidth: 140, paddingHorizontal: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: book ? c.accent : c.border, backgroundColor: book ? c.selected : c.surface }}
          >
            <Txt v="button" color={book ? 'accent' : 'text'} numberOfLines={1} style={{ flexShrink: 1 }}>{book ? hitBookName(book, lang) : SEARCH.book}</Txt>
            <Icon name="chevronDown" size={12} color={book ? c.accent : c.muted} />
          </Pressable>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {view.kind === 'preparing' && <Preparing bible={bible} progress={view.progress} onBack={leave} />}
        {view.kind === 'unavailable' && <Message text={SEARCH.unavailable} />}
        {view.kind === 'failed' && <Message text={SEARCH.failed} action={{ label: SEARCH.retry, onPress: retry }} />}
        {view.kind === 'loading' && (
          <View style={{ padding: 16, gap: 10 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton height={12} />
            <Skeleton width="80%" height={12} />
          </View>
        )}
        {view.kind === 'results' && (
          <ResultsOrEmpty hits={hits} extra={view.extra} terms={terms} bible={bible} source={source} onOpen={openHit} />
        )}
      </View>

      {booksOpen && <BookFilterSheet hits={filterHits(hits, { testament, book: null })} onClose={() => setBooksOpen(false)} />}
    </View>
  );
}

function ResultsOrEmpty({ hits, extra, terms, bible, source, onOpen }: { hits: Vid[]; extra: number; terms: string[]; bible: string; source: string; onOpen: (vid: Vid, list: Vid[]) => void }) {
  const { query, testament, book } = useSearch();
  const filtered = filterHits(hits, { testament, book });
  if (filtered.length > 0) return <SearchResults hits={filtered} extra={extra} terms={terms} bible={bible} source={source} onOpen={onOpen} />;
  return (
    <View testID="search-empty" style={{ alignItems: 'center', gap: space[5], paddingHorizontal: 24, paddingTop: 48 }}>
      <Txt v="sheetTitle" center>{SEARCH.noneTitle(query)}</Txt>
      <Txt v="bodySm" color="muted" center>{hits.length > 0 ? SEARCH.noneFiltered : SEARCH.noneBody(bible)}</Txt>
      {hits.length > 0 && (
        <View style={{ alignSelf: 'stretch' }}>
          <FormButton testID="search-all" variant="secondary" label={SEARCH.searchAll(hits.length)} onPress={() => useSearch.getState().setTestament('all')} />
        </View>
      )}
    </View>
  );
}

function Preparing({ bible, progress, onBack }: { bible: string; progress: number; onBack: () => void }) {
  const { c } = useTheme();
  const pct = Math.round(progress * 100);
  return (
    <View testID="search-preparing" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ margin: 16, marginTop: 24, padding: 16, gap: 10, borderRadius: radius.card, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
      <Txt v="lensTitle">{SEARCH.preparingTitle(bible)}</Txt>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.accent, borderRadius: 3 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt v="meta" color="muted">{SEARCH.preparingLabel}</Txt>
        <Txt v="meta" color="muted">{`${pct}%`}</Txt>
      </View>
      <Txt v="bodySm" color="muted">{SEARCH.preparingBody}</Txt>
      <FormButton variant="secondary" label={SEARCH.back} onPress={onBack} testID="search-prep-back" />
    </View>
  );
}

function Message({ text, action }: { text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ padding: 24, gap: 12, alignItems: 'center' }}>
      <Txt v="bodySm" color="muted" center>{text}</Txt>
      {action && <FormButton variant="secondary" label={action.label} onPress={action.onPress} />}
    </View>
  );
}
