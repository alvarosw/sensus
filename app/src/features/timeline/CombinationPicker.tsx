// Seletor "Criar combinação" (tela cheia): busca em todas as linhas do banco e os mesmos filtros da tela inicial
// (tipo, era, ★ Favoritos). As escolhidas ficam num resumo no topo, com × para tirar; sem limite. Confirmar só com
// pelo menos uma. Usado na entrada do paralelo e no "+ Linha" (com as linhas da tela já marcadas).
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TimelineLine } from '@sensus/core';
import { Txt, radius, space, useTheme } from '@/design';
import { useAppPrefs } from '@/settings/app-prefs';
import { eraById, filterLines, spanText, type KindFilter } from './model';
import { TL } from './strings';
import { KindMark, LaneChip, SearchField, kindColor } from './parts';
import { useTimelineSearch } from './useTimeline';
import { LineFilterChips, useLineMatches } from './LineFilters';
import { canConfirm } from '@sensus/core';
import { useTimelineName, useTimelineNames } from '@/translate/timeline-translate';

export function CombinationPicker({
  lines,
  initial,
  onConfirm,
  onClose,
}: {
  /** Todas as linhas do banco. */
  lines: TimelineLine[];
  /** Linhas já escolhidas (o "+ Linha" do paralelo começa com elas marcadas). */
  initial: readonly string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { c, st } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [eraId, setEraId] = useState('all');
  const [onlyFav, setOnlyFav] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => [...initial]);
  const favLineIds = useAppPrefs((s) => s.timelineLines);

  const byId = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const favorites = useMemo(() => new Set(favLineIds), [favLineIds]);

  // Busca e filtros: os mesmos da tela inicial (ver LineFilters e HomeView).
  const q = query.trim();
  const hits = useTimelineSearch(query);
  const searchLines = useLineMatches(query, lines, hits);
  const filter = { kind, era: eraById(eraId), onlyFavorites: onlyFav, favorites };
  const source = q ? (hits === null ? null : searchLines) : lines;
  const list = useMemo(() => (source ? filterLines(source, filter) : []), [source, kind, eraId, onlyFav, favorites]);

  const trLine = useTimelineNames(selected.map((id) => byId.get(id)).filter((l): l is TimelineLine => l !== undefined));
  const enabled = canConfirm(selected);

  const toggle = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], minHeight: 56 }}>
          <Pressable testID="tlc-cancel" accessibilityRole="button" accessibilityLabel={TL.cancel} onPress={onClose} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4] }}>
            <Txt v="button" tint={c.muted}>{TL.cancel}</Txt>
          </Pressable>
          <Txt v="sheetTitle" accessibilityRole="header">{TL.pickerTitle}</Txt>
          <Pressable
            testID="tlc-confirm"
            accessibilityRole="button"
            accessibilityLabel={TL.confirm}
            accessibilityState={{ disabled: !enabled }}
            disabled={!enabled}
            onPress={() => onConfirm(selected)}
            style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4], opacity: !enabled ? 0.35 : pressed ? 0.7 : 1 })}
          >
            <Txt v="button" tint={c.accent}>{TL.confirm}</Txt>
          </Pressable>
        </View>

        {/* Resumo das escolhidas: rolagem na horizontal, para não empurrar a busca. */}
        <View style={{ gap: space[3], paddingHorizontal: space[4], paddingBottom: space[4], borderBottomWidth: 1, borderBottomColor: c.border }}>
          <Txt v="meta" color="muted">{TL.pickerSelected(selected.length)}</Txt>
          {enabled ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space[3] }}>
              {selected.map((id, i) => {
                const line = byId.get(id);
                if (!line) return null;
                return (
                  <LaneChip
                    key={id}
                    testID={`tlc-sel-${id}`}
                    name={trLine(line)}
                    color={kindColor(line.kind, st)}
                    onRemove={() => toggle(id)}
                  />
                );
              })}
            </ScrollView>
          ) : (
            <Txt v="bodySm" color="muted">{TL.pickerEmpty}</Txt>
          )}
        </View>

        <View style={{ gap: space[4], paddingHorizontal: space[4], paddingTop: space[4] }}>
          <SearchField testID="tlc-search" value={query} onChangeText={setQuery} placeholder={TL.searchPlaceholder} />
          <LineFilterChips
            prefix="tlc"
            kind={kind}
            onKind={setKind}
            eraId={eraId}
            onEra={setEraId}
            onlyFav={onlyFav}
            onOnlyFav={setOnlyFav}
          />
        </View>

        {source === null ? (
          <Txt v="meta" color="muted" style={{ padding: space[8] }}>{TL.noDataYet}</Txt>
        ) : (
          <FlatList
            testID="tlc-list"
            data={list}
            keyExtractor={(l) => l.id}
            extraData={selectedSet}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            contentContainerStyle={{ paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[12] }}
            renderItem={({ item }) => <PickRow line={item} on={selectedSet.has(item.id)} onToggle={() => toggle(item.id)} />}
            ListEmptyComponent={
              <Txt v="bodySm" color="muted" style={{ padding: space[6] }}>{q ? TL.pickNone(q) : TL.noLines}</Txt>
            }
          />
        )}
      </View>
    </Modal>
  );
}

/** Uma linha do seletor: marca de tipo, nome traduzido (se houver tradução), tipo · eventos · anos, e a marca. */
function PickRow({ line, on, onToggle }: { line: TimelineLine; on: boolean; onToggle: () => void }) {
  const { c } = useTheme();
  const name = useTimelineName(line);
  return (
    <Pressable
      testID={`tlc-row-${line.id}`}
      accessibilityRole="checkbox"
      accessibilityLabel={name}
      accessibilityState={{ checked: on }}
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[4],
        minHeight: 56,
        paddingHorizontal: space[4],
        marginBottom: space[2],
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: on ? c.accent : c.border,
        backgroundColor: c.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <KindMark kind={line.kind} small />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="bodySm" bold numberOfLines={1}>{name}</Txt>
        <Txt v="meta" color="muted" numberOfLines={1}>{`${TL.kindLabel[line.kind]} · ${TL.lineTitleOf(line.count)} · ${spanText(line.from, line.to)}`}</Txt>
      </View>
      <Txt v="meta" tint={on ? c.accent : c.muted} bold>{on ? '✓' : '+'}</Txt>
    </Pressable>
  );
}
