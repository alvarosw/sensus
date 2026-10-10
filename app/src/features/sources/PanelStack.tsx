// Painéis empilhados em tela cheia (proto: .panel): entram pela direita, com trilha (crumbs) para voltar.
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamilies, IconButton, motion, size, Txt, useTheme } from '@/design';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { useStudy, type PanelEntry } from '@/state/study';
import { loadCite, loadLexicon, loadSources } from '../common/cites';
import { rangeLabel } from '../common/format';
import { useBooks } from '../common/hooks';
import { useLast, usePresence } from '../common/motion';
import { SRC } from '../common/strings';
import { EntityPanel } from './EntityPanel';
import { SourcePanel } from './SourcePanel';
import { WordPanel } from './WordPanel';

export function PanelStack() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const panels = useStudy((s) => s.panels);
  const popPanel = useStudy((s) => s.popPanel);
  const shown = useLast<PanelEntry[]>(panels.length > 0 ? panels : null);
  const { progress, mounted } = usePresence(panels.length > 0, motion.panel);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: `${(1 - progress.value) * 100}%` }] }));

  if (!mounted || !shown) return null;
  const top = shown[shown.length - 1] as PanelEntry;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 14 }]}>
      <Animated.View
        testID={`panel-${top.kind}`}
        accessibilityViewIsModal
        pointerEvents={panels.length > 0 ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: c.surface }, slide]}
      >
        <View
          style={{
            height: size.topBar + insets.top,
            paddingTop: insets.top,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          <IconButton testID="panel-back" icon="back" label={SRC.back} onPress={popPanel} />
          <Crumbs panels={shown} />
        </View>
        <ScrollView
          key={`${shown.length}-${entryKey(top)}`}
          testID="panel-body"
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 16 + insets.bottom, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          <PanelBody entry={top} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function entryKey(e: PanelEntry): string {
  switch (e.kind) {
    case 'word':
      return e.tokenCiteId;
    case 'lemma':
      return e.strongBase;
    default:
      return e.citeId;
  }
}

function PanelBody({ entry }: { entry: PanelEntry }) {
  switch (entry.kind) {
    case 'word':
    case 'lemma':
      return <WordPanel entry={entry} />;
    case 'source':
      return <SourcePanel citeId={entry.citeId} />;
    case 'entity':
      return <EntityPanel citeId={entry.citeId} />;
  }
}

/** Rótulo e fonte da trilha para uma entrada (o grego usa Gentium). */
function useCrumb(entry: PanelEntry): { label: string; greek: boolean } {
  const repo = useRepo();
  const key = `${entry.kind}:${entryKey(entry)}`;
  const state = useAsync<{ label: string; greek: boolean }>(async () => {
    switch (entry.kind) {
      case 'word': {
        const d = await loadCite(repo, entry.tokenCiteId);
        return { label: d?.label ?? '?', greek: true };
      }
      case 'lemma': {
        const entries = await loadLexicon(repo, entry.strongBase);
        return { label: entries[0]?.lemma ?? entry.strongBase, greek: true };
      }
      case 'source': {
        if (entry.citeId.startsWith('src:')) {
          const s = (await loadSources(repo)).get(entry.citeId.slice(4));
          return { label: s?.title ?? entry.citeId, greek: false };
        }
        const d = await loadCite(repo, entry.citeId);
        return { label: d?.label ?? '?', greek: false };
      }
      case 'entity': {
        const d = await loadCite(repo, entry.citeId);
        return { label: d?.label ?? '?', greek: false };
      }
    }
  }, [repo, key]);
  return state.data ?? { label: '…', greek: false };
}

function Crumbs({ panels }: { panels: PanelEntry[] }) {
  const { c } = useTheme();
  const books = useBooks();
  const chatOpen = useStudy((s) => s.chatOpen);
  const selection = useStudy((s) => s.selection);
  const popPanelsTo = useStudy((s) => s.popPanelsTo);
  const root = chatOpen
    ? SRC.rootChat
    : selection
      ? SRC.rootStudy(rangeLabel(selection, books).replace(/^\S+\s/, ''))
      : SRC.rootRead;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1, minWidth: 0 }}
      contentContainerStyle={{ alignItems: 'center', gap: 4, paddingRight: 8 }}
      testID="crumbs"
    >
      <Pressable testID="crumb-root" accessibilityRole="button" hitSlop={6} onPress={() => popPanelsTo(-1)} style={{ paddingVertical: 4, paddingHorizontal: 2 }}>
        <Txt v="meta" color="accent" bold style={{ fontSize: 12.5 }}>{root}</Txt>
      </Pressable>
      {panels.map((p, i) => (
        <Fragment key={`${i}-${entryKey(p)}`}>
          <Txt v="meta" color="muted" style={{ fontSize: 12.5 }}>›</Txt>
          <CrumbItem entry={p} index={i} last={i === panels.length - 1} onPress={() => popPanelsTo(i)} />
        </Fragment>
      ))}
    </ScrollView>
  );
  void c;
}

function CrumbItem({ entry, index, last, onPress }: { entry: PanelEntry; index: number; last: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const { label, greek } = useCrumb(entry);
  const text = (
    <Text
      numberOfLines={1}
      style={{
        fontFamily: greek ? fontFamilies.greekBold : fontFamilies.uiBold,
        fontSize: greek ? 13.5 : 12.5,
        color: last ? c.text : c.accent,
      }}
    >
      {label}
    </Text>
  );
  if (last) return <View testID={`crumb-${index}`} style={{ paddingVertical: 4, paddingHorizontal: 2 }}>{text}</View>;
  return (
    <Pressable testID={`crumb-${index}`} accessibilityRole="button" hitSlop={6} onPress={onPress} style={{ paddingVertical: 4, paddingHorizontal: 2 }}>
      {text}
    </Pressable>
  );
}
