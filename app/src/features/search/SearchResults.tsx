// Lista de resultados: resumo e regra, faixa de contagem por livro, sugestão do prefixo e os grupos por livro
// (cabeçalho fixo ao rolar, 3 versículos e "Mais N"), com o termo destacado no trecho.
import { useMemo } from 'react';
import { Pressable, ScrollView, SectionList, Text, View } from 'react-native';
import type { Vid } from '@sensus/core';
import { LinkButton, Txt, fontFamilies, radius, space, type as typeScale, useTheme } from '@/design';
import { matchRanges } from '@/data/bibles/search-model';
import { currentBcp47 } from '@/i18n';
import { useLang } from '@/i18n/lang-store';
import { countByBook, groupHits, hitBookAbbr, hitBookName, hitRef, snippetParts } from './search-model';
import { useSearch } from './search-store';
import { SEARCH } from './strings';
import { useHitTexts } from './useSearchResults';

interface Props {
  hits: Vid[];
  extra: number;
  terms: string[];
  bible: string;
  source: string;
  onOpen: (vid: Vid, list: Vid[]) => void;
}

export function SearchResults({ hits, extra, terms, bible, source, onOpen }: Props) {
  const { c } = useTheme();
  const lang = useLang();
  const { query, prefix, book, expanded } = useSearch();
  const groups = useMemo(() => groupHits(hits, new Set(expanded)), [hits, expanded]);
  const shown = useMemo(() => groups.flatMap((g) => g.shown), [groups]);
  const texts = useHitTexts(source, shown);
  const counts = useMemo(() => countByBook(hits), [hits]);
  const sections = groups.map((g) => ({ key: String(g.book), group: g, data: g.shown }));
  const shownCount = hits.length.toLocaleString(currentBcp47());

  const header = (
    <View style={{ paddingTop: 12, gap: space[4] }}>
      <View style={{ paddingHorizontal: 16, gap: 2 }}>
        <Txt v="body" bold testID="search-summary">
          {book ? SEARCH.summaryIn(hits.length, shownCount, hitBookName(book, lang)) : SEARCH.summary(hits.length, shownCount, counts.length)}
        </Txt>
        <Txt v="meta" color="muted">{prefix ? SEARCH.rulePrefix(query, bible) : SEARCH.ruleWord(bible)}</Txt>
      </View>
      {!book && counts.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }} style={{ flexGrow: 0 }}>
          {counts.map(({ book: b, count }) => (
            <Pressable
              key={b}
              testID={`search-strip-${b}`}
              accessibilityRole="button"
              accessibilityLabel={`${hitBookName(b, lang)}, ${count}`}
              onPress={() => useSearch.getState().setBook(b)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 9, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}
            >
              <Txt v="meta" bold>{hitBookAbbr(b, lang)}</Txt>
              <Txt v="meta" color="muted">{String(count)}</Txt>
            </Pressable>
          ))}
          <View style={{ width: 10 }} />
        </ScrollView>
      )}
      {(extra > 0 || prefix) && (
        <View style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: space[5], padding: 10, borderRadius: radius.xl, backgroundColor: c.surfaceAlt }}>
          <Txt v="bodySm" style={{ flex: 1 }}>{prefix ? SEARCH.prefixOn(query) : SEARCH.prefixOffer(extra, query)}</Txt>
          <LinkButton testID="search-prefix" label={prefix ? SEARCH.onlyWord : SEARCH.include} onPress={() => useSearch.getState().setPrefix(!prefix)} />
        </View>
      )}
      <View style={{ height: space[3] }} />
    </View>
  );

  return (
    <SectionList
      testID="search-results"
      sections={sections}
      keyExtractor={(vid) => String(vid)}
      stickySectionHeadersEnabled
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      renderSectionHeader={({ section }) => (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border }}>
          <Txt v="lensTitle" style={{ fontSize: 15 }}>{hitBookName(section.group.book, lang)}</Txt>
          <Txt v="meta" color="muted">{String(section.group.total)}</Txt>
        </View>
      )}
      renderItem={({ item }) => {
        const text = texts.get(item);
        return (
          <Pressable testID={`search-hit-${item}`} accessibilityRole="button" onPress={() => onOpen(item, hits)} style={({ pressed }) => ({ paddingHorizontal: 16, paddingTop: 9, paddingBottom: 11, backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
            <Txt v="meta" color="accent" bold>{hitRef(item, lang)}</Txt>
            {text === undefined ? (
              <View style={{ height: 22, marginTop: 4, width: '80%', borderRadius: 4, backgroundColor: c.surfaceAlt }} />
            ) : (
              <Text numberOfLines={3} style={{ ...typeScale.excerpt, fontSize: 14.5, lineHeight: 22, color: c.text, marginTop: 2 }}>
                {snippetParts(text, matchRanges(text, terms, prefix)).map((p, i) =>
                  p.hit ? (
                    <Text key={i} style={{ backgroundColor: c.highlight, fontFamily: fontFamilies.readSemibold }}>{p.text}</Text>
                  ) : (
                    <Text key={i}>{p.text}</Text>
                  ),
                )}
              </Text>
            )}
          </Pressable>
        );
      }}
      renderSectionFooter={({ section }) =>
        section.group.more > 0 ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <LinkButton testID={`search-more-${section.group.book}`} label={SEARCH.moreIn(section.group.more, hitBookName(section.group.book, lang))} onPress={() => useSearch.getState().expand(section.group.book)} />
          </View>
        ) : null
      }
      ListFooterComponent={<Txt v="meta" color="muted" center style={{ paddingVertical: 24 }}>{SEARCH.end}</Txt>}
    />
  );
}
