// Painéis empilhados em tela cheia (proto: .panel): entram pela direita, com trilha (crumbs) para voltar.
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dirOf, scriptOf, type Repo, type Script } from '@sensus/core';
import { fontFamilies, IconButton, motion, size, Txt, useTheme } from '@/design';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { useStudy, type PanelEntry } from '@/state/study';
import { BACK_PRIORITY, useBackLayer } from '../common/back';
import { loadCite, loadLexicon, loadSources } from '../common/cites';
import { refShort } from '../common/format';
import { useBooks } from '../common/hooks';
import { useLast, usePresence } from '../common/motion';
import { SRC } from '../common/strings';
import { MAPS, MapPanel } from '@/features/maps';
import { EntityPanel } from './EntityPanel';
import { SourcePanel } from './SourcePanel';
import { WordPanel } from './WordPanel';

export function PanelStack() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const panels = useStudy((s) => s.panels);
  const popPanel = useStudy((s) => s.popPanel);
  useBackLayer('panels', panels.length > 0, popPanel, BACK_PRIORITY.panel);
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
        {top.kind === 'map' ? (
          // Mapa ocupa a tela: sem ScrollView, para o gesto do mapa não disputar a rolagem.
          <View key={`${shown.length}-${entryKey(top)}`} testID="panel-body" style={{ flex: 1 }}>
            <PanelBody entry={top} />
          </View>
        ) : (
          <ScrollView
            key={`${shown.length}-${entryKey(top)}`}
            testID="panel-body"
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 16 + insets.bottom, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <PanelBody entry={top} />
          </ScrollView>
        )}
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
    case 'map':
      return `${e.scope.range.start}-${e.scope.range.end}`;
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
    case 'map':
      return <MapPanel scope={entry.scope} />;
  }
}

/** Rótulo da trilha e a escrita dele: palavra grega ou hebraica usa Gentium e segue a direção da escrita. */
interface Crumb {
  label: string;
  script: Script;
}

function useCrumb(entry: PanelEntry): Crumb {
  const repo = useRepo();
  const key = `${entry.kind}:${entryKey(entry)}`;
  const state = useAsync<Crumb>(async () => {
    const label = await labelOf(repo, entry);
    return { label, script: scriptOf(label) };
  }, [repo, key]);
  return state.data ?? { label: '…', script: 'other' };
}

async function labelOf(repo: Repo, entry: PanelEntry): Promise<string> {
  switch (entry.kind) {
    case 'word':
      return (await loadCite(repo, entry.tokenCiteId))?.label ?? '?';
    case 'lemma': {
      const entries = await loadLexicon(repo, entry.strongBase);
      return entries[0]?.lemma ?? entry.strongBase;
    }
    case 'source': {
      if (entry.citeId.startsWith('src:')) {
        const s = (await loadSources(repo)).get(entry.citeId.slice(4));
        return s?.title ?? entry.citeId;
      }
      return (await loadCite(repo, entry.citeId))?.label ?? '?';
    }
    case 'entity':
      return (await loadCite(repo, entry.citeId))?.label ?? '?';
    case 'map':
      return MAPS.title;
  }
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
      ? SRC.rootStudy(refShort(selection.start, selection.end, books, true).replace(/^\S+\s/, ''))
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
  const { label, script } = useCrumb(entry);
  const original = script === 'greek' || script === 'hebrew';
  const text = (
    <Text
      numberOfLines={1}
      style={{
        fontFamily: original ? fontFamilies.greekBold : fontFamilies.uiBold,
        fontSize: original ? 13.5 : 12.5,
        color: last ? c.text : c.accent,
        writingDirection: dirOf(script),
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
