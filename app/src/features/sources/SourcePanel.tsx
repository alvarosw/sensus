// Painel de fonte (tela cheia): texto completo, referências, licença e tradução de fontes em inglês.
import { useMemo } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { googleTranslateLinks, type Source, type Vid } from '@sensus/core';
import { Empty, LinkButton, Skeleton, SubHeader, Tag, Txt, TypeMark, useTheme } from '@/design';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { APP_LANG } from '@/i18n';
import { useStudy } from '@/state/study';
import { traditionLabel } from '../study/format';
import { askAbout, showInText } from '../common/actions';
import { loadSources, loadXrefText, type CiteDetail } from '../common/cites';
import { useBooks, useCite } from '../common/hooks';
import { SRC } from '../common/strings';
import { useAutoTranslate } from '@/translate/useAutoTranslate';
import { AutoTranslateNote } from '@/translate/AutoTranslateNote';
import { useTranslate } from '@/translate/store';
import { useSourceLang } from '@/translate/source-lang';
import { LicenseBlock, RefChips } from './PanelParts';

export function SourcePanel({ citeId }: { citeId: string }) {
  const repo = useRepo();
  const sourceOnly = citeId.startsWith('src:');
  const cite = useCite(sourceOnly ? null : citeId);
  const sources = useAsync(() => loadSources(repo), [repo]);

  if (sourceOnly) {
    const source = sources.data?.get(citeId.slice('src:'.length));
    if (sources.loading) return <PanelSkeleton />;
    if (!source) return <Empty text={SRC.loadError} />;
    return <SourceOnlyBody source={source} citeId={citeId} />;
  }
  if (cite.loading) return <PanelSkeleton />;
  if (!cite.detail) return <Empty text={cite.error ? SRC.loadError : SRC.notFound} />;
  return <SourceBody detail={cite.detail} />;
}

function PanelSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton width="30%" />
      <Skeleton width="60%" height={26} />
      <Skeleton width="45%" />
      <Skeleton />
      <Skeleton />
      <Skeleton width="80%" />
    </View>
  );
}

function SourceOnlyBody({ source, citeId }: { source: Source; citeId: string }) {
  return (
    <View style={{ gap: 12 }}>
      <Txt v="panelTitle" testID="panel-title">{source.title}</Txt>
      {source.author ? <Txt v="bodySm" color="muted">{source.author}</Txt> : null}
      <LicenseBlock sources={[source]} citeId={citeId} />
    </View>
  );
}

/** Texto completo do registro (o que a prévia só resume). */
function fullTextOf(d: CiteDetail, xrText: string): string {
  const r = d.record;
  switch (r.table) {
    case 'xref':
      return xrText;
    case 'lexicon_entry':
      return [r.record.gloss, r.record.definition].filter(Boolean).join('\n\n');
    default:
      return d.text;
  }
}

function SourceBody({ detail }: { detail: CiteDetail }) {
  const { c } = useTheme();
  const repo = useRepo();
  const books = useBooks();
  const { source, record } = detail;

  const xr = useAsync<string>(async () => {
    if (record.table !== 'xref') return '';
    const verses = await loadXrefText(repo, record.record.to_start_vid, record.record.to_end_vid);
    return verses.map((v) => v.text).join('\n\n');
  }, [repo, detail.citeId]);

  const text = fullTextOf(detail, xr.data ?? '');
  // Texto de versículo (xref) vem da Bíblia escolhida (blivre = pt, kjv = en), não da fonte da ligação.
  const textSource = useStudy((s) => s.textSource);
  const textSourceLang = useSourceLang(textSource);
  const textLang = record.table === 'xref' ? textSourceLang : (source?.lang ?? null);
  const tr = useAutoTranslate(text || null, textLang);
  const translateOn = useTranslate((s) => s.enabled);
  const links = useMemo(
    () => (textLang === 'en' && text ? googleTranslateLinks(text, APP_LANG, 'en') : []),
    [textLang, text],
  );
  const refs: Vid[] = detail.ranges.map((r) => r.start);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <TypeMark kind={detail.kind} label={detail.typeLabel} />
        {source?.tradition ? <Tag label={traditionLabel(source.tradition)} /> : null}
      </View>
      <Txt v="panelTitle" testID="panel-title">{detail.label}</Txt>
      {source ? <Txt v="bodySm" color="muted" style={{ fontSize: 13 }}>{source.title}</Txt> : null}
      {source?.author ? <Txt v="bodySm" color="muted" style={{ fontSize: 13 }}>{source.author}</Txt> : null}

      {xr.loading && record.table === 'xref' ? (
        <Skeleton height={80} />
      ) : text ? (
        <View style={{ gap: 6 }}>
          <Txt v="fullText" testID="panel-fulltext" selectable>{tr.display}</Txt>
          <AutoTranslateNote tr={tr} testID="panel-tr" />
        </View>
      ) : null}

      {refs.length > 0 ? (
        <>
          <SubHeader label={SRC.references} />
          <RefChips
            testIDPrefix="srcref"
            vids={refs}
            books={books}
            onPress={(vid) => showInText(vid)}
          />
        </>
      ) : null}

      {links.length > 0 && (!translateOn || tr.failed) ? (
        <>
          <SubHeader label={SRC.translate} />
          <Txt v="meta" color="muted" style={{ fontSize: 12 }}>{SRC.translateHint}</Txt>
          <View style={{ gap: 6 }}>
            {links.map((link, i) => (
              <Pressable
                key={link}
                testID={`translate-${i}`}
                accessibilityRole="link"
                onPress={() => Linking.openURL(link)}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Txt v="button" color="accent">
                  {links.length > 1 ? SRC.translatePart(i + 1, links.length) : SRC.translate}
                </Txt>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
        <LinkButton testID="panel-ask" label={SRC.askSource} onPress={() => askAbout(detail, { closePanels: true })} />
        {detail.vid !== null ? <LinkButton testID="panel-show" label={SRC.show} onPress={() => showInText(detail.vid as number)} /> : null}
        {detail.kind === 'xr' && record.table === 'xref' ? (
          <LinkButton
            testID="panel-pin"
            label={SRC.pin}
            onPress={() => {
              const x = record.record;
              const s = useStudy.getState();
              s.pin({ citeId: detail.citeId, start: x.to_start_vid, end: x.to_end_vid });
              s.closePanels();
              s.closeChat();
            }}
          />
        ) : null}
      </View>

      <LicenseBlock sources={[source]} citeId={detail.citeId} />
    </View>
  );
}

