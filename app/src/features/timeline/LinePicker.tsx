// Folha "+ Linha": busca em todas as linhas do banco (no núcleo, com limite e ordem por relevância). Sem texto,
// mostra favoritas, recentes e combinações prontas. Linhas já na tela aparecem desabilitadas ("na tela").
import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import type { TimelineLine } from '@sensus/core';
import { Txt, radius, space, useTheme } from '@/design';
import { PARALLEL_MAX_LANES, spanText } from './model';
import { PARALLEL_COMBOS } from './parallel-lanes';
import { TL } from './strings';
import { KindMark, SearchField } from './parts';
import { useTimelineLineSearch } from './useTimeline';
import { useTimelineTexts, useTimelineActive, useTimelineVersion } from '@/translate/timeline-translate';
import { cachedTranslation } from '@/translate/engine';
import { matchesTranslatedText } from '@sensus/core';

export function LinePicker({
  lines,
  laneIds,
  favorites,
  recent,
  onAdd,
  onCombo,
  onClose,
}: {
  /** Todas as linhas do banco (para resolver favoritas e recentes). */
  lines: TimelineLine[];
  laneIds: readonly string[];
  favorites: readonly string[];
  recent: readonly string[];
  onAdd: (line: TimelineLine) => void;
  onCombo: (ids: readonly string[]) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [text, setText] = useState('');
  const found = useTimelineLineSearch(text);
  const byId = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);
  const onScreen = new Set(laneIds);
  const full = laneIds.length >= PARALLEL_MAX_LANES;
  const hasText = text.trim().length > 0;

  const favs = favorites.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const rec = recent.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));

  // Busca: o banco (original) mais as linhas cuja tradução já está no cache.
  const tlActive = useTimelineActive();
  const version = useTimelineVersion();
  const searchHits = useMemo(() => {
    if (!hasText) return [];
    const db = found ?? [];
    if (!tlActive) return db;
    const extra = lines.filter((l) => !db.some((x) => x.id === l.id) && matchesTranslatedText(text.trim(), l.name, cachedTranslation(l.name)));
    return [...db, ...extra];
    // version: a tradução chegou ao cache; a busca considera a tradução nova.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found, hasText, lines, tlActive, text, version]);

  // Nomes na tela (busca, favoritas, recentes e combinações) traduzidos num só lote.
  const listed = hasText ? searchHits : [...favs, ...rec];
  const tr = useTimelineTexts([...listed.map((l) => l.name), ...PARALLEL_COMBOS.flatMap((c) => c.lines.map((id) => byId.get(id)?.name ?? ''))]);

  const row = (line: TimelineLine) => {
    const here = onScreen.has(line.id);
    const disabled = here || full;
    return (
      <Pressable
        key={line.id}
        testID={`tl-pick-${line.id}`}
        accessibilityRole="button"
        accessibilityLabel={tr(line.name)}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onAdd(line)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space[5], minHeight: 52, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}
      >
        <KindMark kind={line.kind} small />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="bodySm" bold numberOfLines={1}>{tr(line.name)}</Txt>
          <Txt v="meta" color="muted" numberOfLines={1}>{`${TL.kindLabel[line.kind]} · ${TL.lineTitleOf(line.count)} · ${spanText(line.from, line.to)}`}</Txt>
        </View>
        <Txt v="meta" tint={here ? c.muted : c.accent} bold>{here ? TL.onScreen : '+'}</Txt>
      </Pressable>
    );
  };

  const section = (title: string, children: ReactNode) => (
    <View style={{ gap: space[3] }}>
      <Txt v="eyebrow" color="muted">{title}</Txt>
      {children}
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={TL.done} onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.scrim }} />
        <View
          testID="tl-picker"
          accessibilityViewIsModal
          style={{ maxHeight: '86%', backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space[4], paddingBottom: space[8], paddingHorizontal: space[8], gap: space[5] }}
        >
          <View style={{ alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: c.border }} />
          <Txt v="sheetTitle" accessibilityRole="header">{TL.pickTitle}</Txt>
          <SearchField testID="tl-picker-search" value={text} onChangeText={setText} placeholder={TL.pickPlaceholder} />
          <Txt v="meta" color="muted">{TL.pickNote(laneIds.length)}</Txt>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space[5], paddingBottom: space[2] }}>
            {hasText ? (
              found === null && searchHits.length === 0 ? (
                <Txt v="meta" color="muted">{TL.noDataYet}</Txt>
              ) : searchHits.length === 0 ? (
                <Txt v="bodySm" color="muted">{TL.pickNone(text.trim())}</Txt>
              ) : (
                searchHits.map(row)
              )
            ) : (
              <>
                {favs.length > 0 && section(TL.pickFavorites, favs.map(row))}
                {rec.length > 0 && section(TL.pickRecent, rec.map(row))}
                {section(
                  TL.combos,
                  <View style={{ gap: space[3] }}>
                    {PARALLEL_COMBOS.map((combo) => (
                      <Pressable
                        key={combo.id}
                        testID={`tl-combo-${combo.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={combo.name}
                        onPress={() => onCombo(combo.lines)}
                        style={({ pressed }) => ({ borderWidth: 1, borderColor: c.border, borderRadius: radius.card, padding: space[4], gap: 2, opacity: pressed ? 0.7 : 1 })}
                      >
                        <Txt v="bodySm" bold>{combo.name}</Txt>
                        <Txt v="meta" color="muted" numberOfLines={2}>
                          {combo.lines.map((id) => tr(byId.get(id)?.name ?? '')).filter(Boolean).join(' · ')}
                        </Txt>
                      </Pressable>
                    ))}
                  </View>,
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
