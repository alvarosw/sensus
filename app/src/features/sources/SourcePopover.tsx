// Prévia de citação (proto: .pop): cartão na base com trecho, fonte, tradição e cite_id; sobe sobre um véu.
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatShortRef, traditionLabel } from '@sensus/core';
import {
  fontFamilies,
  IconButton,
  motion,
  radius,
  shadow,
  Skeleton,
  Tag,
  Txt,
  TypeMark,
  useTheme,
  MorphPill,
} from '@/design';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { useStudy } from '@/state/study';
import { askAbout, panelFor, showInText } from '../common/actions';
import { BACK_PRIORITY, useBackLayer } from '../common/back';
import { PopButton } from '../common/Buttons';
import { loadLexicon, loadXrefText, pickLexicon, type CiteDetail } from '../common/cites';
import { useBooks, useCite } from '../common/hooks';
import { morphPills } from '../common/morph-pt';
import { useLast, usePresence } from '../common/motion';
import { SRC } from '../common/strings';
import { useAutoTranslate } from '@/translate/useAutoTranslate';
import { AutoTranslateNote } from '@/translate/AutoTranslateNote';
import { useSourceLang } from '@/translate/source-lang';

export function SourcePopover() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const citeId = useStudy((s) => s.popoverCite);
  const closePopover = useStudy((s) => s.closePopover);
  useBackLayer('popover', citeId != null, closePopover, BACK_PRIORITY.popover);
  const shownId = useLast(citeId);
  const { progress, mounted } = usePresence(citeId !== null, motion.pop);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const card = useAnimatedStyle(() => ({
    transform: [{ translateY: `${interpolate(progress.value, [0, 1], [110, 0])}%` }],
  }));

  if (!mounted || !shownId) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 12 }]}>
      <Animated.View
        pointerEvents={citeId ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrim]}
      >
        <Pressable
          testID="popover-scrim"
          accessibilityLabel={SRC.close}
          style={StyleSheet.absoluteFill}
          onPress={closePopover}
        />
      </Animated.View>
      <Animated.View
        testID="popover"
        accessibilityViewIsModal
        pointerEvents={citeId ? 'auto' : 'none'}
        style={[
          {
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: 8 + insets.bottom,
            maxHeight: '62%',
            backgroundColor: c.surface,
            borderRadius: radius.pop,
            borderWidth: 1,
            borderColor: c.border,
            paddingTop: 14,
            paddingHorizontal: 14,
            paddingBottom: 12,
            gap: 8,
            ...shadow.pop,
          },
          card,
        ]}
      >
        <PopoverBody citeId={shownId} onClose={closePopover} />
      </Animated.View>
    </View>
  );
}

function PopoverBody({ citeId, onClose }: { citeId: string; onClose: () => void }) {
  const { c } = useTheme();
  const { loading, detail, error, reload } = useCite(citeId);

  if (loading) {
    return (
      <View style={{ gap: 10, paddingVertical: 4 }}>
        <Skeleton width="40%" />
        <Skeleton />
        <Skeleton width="85%" />
        <Skeleton width="60%" />
      </View>
    );
  }

  if (!detail) {
    return (
      <>
        <CloseButton onPress={onClose} />
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 8, paddingRight: 40 }}>
          <Txt v="body" tint={c.danger} bold testID="popover-invalid">
            {error ? SRC.loadError : SRC.invalidTitle}
          </Txt>
          {error ? null : <Txt v="excerpt">{SRC.notFound}</Txt>}
          {error ? null : <Txt v="bodySm" color="muted">{SRC.invalidShort}</Txt>}
          <Txt v="mono" color="muted" selectable>{`cite_id ${citeId}`}</Txt>
        </ScrollView>
        {error ? (
          <Actions>
            <PopButton testID="popover-retry" label={SRC.retry} onPress={reload} />
          </Actions>
        ) : null}
      </>
    );
  }
  return <ResolvedBody detail={detail} onClose={onClose} />;
}

/** Fechar: botão de ícone no canto superior direito do popover. */
function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
      <IconButton testID="popover-close" icon="close" label={SRC.close} onPress={onPress} />
    </View>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 }}>
      {children}
    </View>
  );
}

function ResolvedBody({ detail, onClose }: { detail: CiteDetail; onClose: () => void }) {
  const { st } = useTheme();
  const repo = useRepo();
  const books = useBooks();
  const pushPanel = useStudy((s) => s.pushPanel);
  const { source, record } = detail;
  const tradition = source?.tradition;

  const open = () => pushPanel(panelFor(detail));
  const show = detail.vid !== null && (detail.kind === 'txt' || detail.kind === 'xr' || detail.kind === 'tok' || detail.kind === 'com');

  const pinXref = () => {
    if (record.table !== 'xref') return;
    const x = record.record;
    const s = useStudy.getState();
    s.pin({ citeId: detail.citeId, start: x.to_start_vid, end: x.to_end_vid });
    s.closePopover();
    s.closeChat();
    if (s.detent === 'full') s.setDetent('half');
    s.showToast({ text: SRC.pinned(formatShortRef(x.to_start_vid, x.to_end_vid, books, true)) });
  };

  return (
    <>
      <CloseButton onPress={onClose} />
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingRight: 40 }}>
          <TypeMark kind={detail.kind} label={detail.typeLabel} />
          {detail.kind === 'tok' ? (
            <Text style={{ fontFamily: fontFamilies.greekBold, fontSize: 15, color: st.tok }}>{detail.label}</Text>
          ) : (
            <Txt v="bodySm" bold style={{ fontSize: 13 }}>{detail.label}</Txt>
          )}
          {detail.labelRef ? <Txt v="bodySm" bold style={{ fontSize: 13 }}>{detail.labelRef}</Txt> : null}
          {tradition ? <Tag label={traditionLabel(tradition)} /> : null}
        </View>
        {source ? <Txt v="meta" color="muted" style={{ fontFamily: fontFamilies.ui }}>{source.title}</Txt> : null}
        <Body detail={detail} repo={repo} />
        <Txt v="mono" color="muted" selectable testID="popover-cite-id">{`cite_id ${detail.citeId}`}</Txt>
        {source ? (
          <Txt v="meta" color="muted" style={{ fontSize: 11, fontFamily: fontFamilies.ui }}>
            {`${SRC.license}: ${source.license}${source.author ? ` · ${source.author}` : ''}`}
          </Txt>
        ) : null}
      </ScrollView>
      <Actions>
        <PopButton primary testID="popover-open" label={detail.kind === 'tok' ? SRC.openWord : SRC.open} onPress={open} />
        {show && detail.vid !== null ? (
          <PopButton testID="popover-show" label={SRC.show} onPress={() => showInText(detail.vid as number)} />
        ) : null}
        {detail.kind === 'xr' ? <PopButton testID="popover-pin" label={SRC.pin} onPress={pinXref} /> : null}
        <PopButton testID="popover-ask" label={SRC.ask} onPress={() => askAbout(detail)} />
      </Actions>
    </>
  );
}

function Body({ detail, repo }: { detail: CiteDetail; repo: ReturnType<typeof useRepo> }) {
  const { st } = useTheme();
  const books = useBooks();
  const { record } = detail;
  const textSource = useStudy((s) => s.textSource);

  const extra = useAsync<{ lex: ReturnType<typeof pickLexicon> | null; xr: string | null }>(async () => {
    if (record.table === 'token' && record.record.strong_base) {
      const entries = await loadLexicon(repo, record.record.strong_base);
      return { lex: pickLexicon(entries, record.record.strong), xr: null };
    }
    if (record.table === 'xref') {
      const verses = await loadXrefText(repo, record.record.to_start_vid, record.record.to_end_vid);
      return { lex: null, xr: verses.map((v) => v.text).join(' ') };
    }
    return { lex: null, xr: null };
  }, [repo, detail.citeId]);

  // Tradução automática do trecho mostrado: o idioma vem da fonte (lexicon, Bíblia escolhida ou a própria fonte).
  const lexSource = extra.data?.lex?.main;
  const lexLang = useSourceLang(lexSource?.source_id ?? null);
  const textLang = useSourceLang(textSource);
  const shownText =
    record.table === 'token'
      ? lexSource
        ? [lexSource.gloss, lexSource.definition].filter(Boolean).join(' — ')
        : null
      : record.table === 'xref'
        ? (extra.data?.xr ?? null)
        : detail.text;
  const shownLang =
    record.table === 'token' ? lexLang : record.table === 'xref' ? textLang : (detail.source?.lang ?? null);
  const tr = useAutoTranslate(shownText || null, shownLang);

  if (record.table === 'token') {
    const t = record.record;
    const pills = morphPills(t.morph_desc);
    const lex = extra.data?.lex?.main;
    return (
      <>
        <Text style={{ fontFamily: fontFamilies.greek, fontSize: 28, lineHeight: 34, color: st.tok }} selectable>
          {detail.label}
        </Text>
        <Txt v="bodySm" color="muted" style={{ fontSize: 13 }}>
          {[t.lemma, t.translit, t.strong, t.gloss_en ? `“${t.gloss_en}”` : null].filter(Boolean).join(' · ')}
        </Txt>
        {pills.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {pills.map((p, i) => (
              <MorphPill key={`${p}-${i}`} label={p} />
            ))}
          </View>
        ) : null}
        {lex ? (
          <>
            <Txt v="excerpt" numberOfLines={7} style={{ fontSize: 13.5 }}>{tr.display}</Txt>
            <AutoTranslateNote tr={tr} testID="popover-tr" />
          </>
        ) : null}
      </>
    );
  }

  if (record.table === 'xref') {
    const x = record.record;
    return (
      <>
        <Txt v="excerpt" numberOfLines={7}>{tr.display}</Txt>
        <AutoTranslateNote tr={tr} testID="popover-tr" />
        <Txt v="meta" color="muted" style={{ fontFamily: fontFamilies.ui }}>
          {[SRC.linkedTo(formatShortRef(x.from_vid, x.from_vid, books, true)), x.weight != null ? SRC.votes(x.weight) : null]
            .filter(Boolean)
            .join(' · ')}
        </Txt>
      </>
    );
  }

  if (record.table === 'entity') {
    const e = record.record;
    return (
      <>
        <Txt v="excerpt" numberOfLines={7}>{tr.display}</Txt>
        <AutoTranslateNote tr={tr} testID="popover-tr" />
        {e.lat != null && e.lon != null ? (
          <Txt v="mono" color="muted">{`${e.lat.toFixed(3)}° · ${e.lon.toFixed(3)}°`}</Txt>
        ) : null}
      </>
    );
  }

  return (
    <>
      <Txt v="excerpt" numberOfLines={7} selectable>{tr.display}</Txt>
      <AutoTranslateNote tr={tr} testID="popover-tr" />
    </>
  );
}
