// Prévia de um evento (folha sobre a tela): ano e referência, pessoas (levam à linha da pessoa), "Também em"
// (outras linhas do evento), "Ler" (leitor com os versículos destacados) e marcador. No paralelo, "Também em"
// vira "+ linha" para pôr a linha na comparação.
// Modo de confirmação (confirm): só título, data, pessoas, começo do texto e "Ler no texto" / "Fechar". Usado onde um
// toque não pode navegar sem confirmação (cartão do Histórico, cronologia do trecho).
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { TimelineLine, TimelineLineEvent, TimelineLineRef, Vid } from '@sensus/core';
import { Txt, radius, space, useTheme } from '@/design';
import { useBooks, useReduceMotion } from '@/features/common/hooks';
import { useAppPrefs } from '@/settings/app-prefs';
import { refShort } from '@/features/common/format';
import { eventYear } from './model';
import { TL } from './strings';
import { useEventDetail, useTimelineLines, useVerseStart } from './useTimeline';
import { openInReader } from './actions';
import { Chip } from './parts';
import { useTimelineText, useTimelineTexts } from '@/translate/timeline-translate';

/** Comparação no paralelo: linhas já na tela e o que fazer ao tocar em "+ linha". */
export interface PreviewCompare {
  onScreen: ReadonlySet<string>;
  onAdd: (line: TimelineLineRef) => void;
}

export function EventPreview({
  citeId,
  currentLineId,
  compare,
  confirm,
  onClose,
}: {
  citeId: string;
  currentLineId?: string;
  compare?: PreviewCompare;
  /** Modo de confirmação: "Ler no texto" entrega os versículos do evento (a prévia fecha antes). */
  confirm?: { onRead: (first: Vid, last: Vid) => void };
  onClose: () => void;
}) {
  const { c } = useTheme();
  const router = useRouter();
  const books = useBooks();
  const reduce = useReduceMotion();
  const lines = useTimelineLines();
  const detail = useEventDetail(citeId);
  const marked = useAppPrefs((s) => s.timelineEvents.includes(citeId));
  const toggleEvent = useAppPrefs((s) => s.toggleTimelineEvent);
  const lineIds = useMemo(() => new Set((lines ?? []).map((l) => l.id)), [lines]);

  const openLine = (id: string) => {
    onClose();
    router.push({ pathname: '/timeline/linha', params: { id } });
  };

  const event = detail?.event ?? null;
  const others = (detail?.lines ?? []).filter((l) => l.id !== currentLineId);
  const people = event?.participants ?? [];
  // Textos da linha do tempo, traduzidos quando configurado (a prévia não repete o aviso: ele fica na tela de trás).
  const title = useTimelineText(event?.title);
  const peopleNames = [...new Set(people.map((p) => p.name).filter(Boolean))];
  const trPeople = useTimelineTexts(peopleNames);
  const trLines = useTimelineTexts(others.map((l) => l.name));
  const verse = useVerseStart(event?.first_vid ?? null, event?.last_vid ?? null);
  // Pessoa com linha própria vira link (exceto a linha em que a prévia já está).
  const personLine = (cite: string): TimelineLine | undefined =>
    lineIds.has(cite) && cite !== currentLineId ? (lines ?? []).find((l) => l.id === cite) : undefined;

  return (
    <Modal visible transparent animationType={reduce ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={TL.close} onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.scrim }} />
        <View
          testID="tl-preview"
          accessibilityViewIsModal
          style={{
            maxHeight: '78%',
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingTop: space[4],
            paddingBottom: space[8],
            paddingHorizontal: space[8],
            gap: space[5],
          }}
        >
          <View style={{ alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: c.border }} />
          {!event ? (
            <Txt v="meta" color="muted">{TL.previewLoading}</Txt>
          ) : confirm ? (
            <ConfirmBody
              event={event}
              title={title}
              verse={verse}
              onRead={() => confirm.onRead(event.first_vid, event.last_vid)}
              onClose={onClose}
            />
          ) : (
            <ScrollView contentContainerStyle={{ gap: space[5] }} showsVerticalScrollIndicator={false}>
              <Txt v="sheetTitle" accessibilityRole="header">{title}</Txt>
              <Txt v="meta" color="muted">
                {`${eventYear(event)} · ${refShort(event.first_vid, event.last_vid, books, true)}`}
              </Txt>

              {people.length > 0 && (
                <View style={{ gap: space[3] }}>
                  <Txt v="eyebrow" color="muted">{TL.people}</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
                    {people.map((p) => {
                      const line = personLine(p.cite_id);
                      return line ? (
                        <Chip key={p.cite_id} testID={`tl-person-${p.cite_id}`} label={`${trPeople(p.name)} →`} on={false} onPress={() => openLine(line.id)} />
                      ) : (
                        <Txt key={p.cite_id} v="meta" color="muted" style={{ paddingVertical: space[2] }}>{trPeople(p.name)}</Txt>
                      );
                    })}
                  </View>
                </View>
              )}

              {others.length > 0 && compare && (
                <View style={{ gap: space[3] }}>
                  <Txt v="eyebrow" color="muted">{TL.alsoIn}</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
                    {others
                      .filter((l) => !compare.onScreen.has(l.id))
                      .map((l) => (
                        <Chip
                          key={l.id}
                          testID={`tl-add-${l.id}`}
                          label={TL.compareAdd(trLines(l.name))}
                          on={false}
                          onPress={() => compare.onAdd(l)}
                        />
                      ))}
                  </View>
                </View>
              )}

              {others.length > 0 && !compare && (
                <View style={{ gap: space[3] }}>
                  <Txt v="eyebrow" color="muted">{TL.alsoIn}</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
                    {others.map((l) => (
                      <Chip key={l.id} testID={`tl-also-${l.id}`} label={`${trLines(l.name)} →`} on={false} onPress={() => openLine(l.id)} />
                    ))}
                  </View>
                </View>
              )}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
                <Pressable
                  testID="tl-read"
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    openInReader(event.first_vid, event.last_vid);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    paddingHorizontal: space[8],
                    borderRadius: radius.lg,
                    backgroundColor: c.accent,
                    justifyContent: 'center',
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Txt v="button" tint={c.accentText}>{TL.read(refShort(event.first_vid, event.last_vid, books, true))}</Txt>
                </Pressable>
                <Pressable
                  testID="tl-mark"
                  accessibilityRole="button"
                  accessibilityState={{ checked: marked }}
                  onPress={() => toggleEvent(citeId)}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    paddingHorizontal: space[8],
                    borderRadius: radius.lg,
                    backgroundColor: c.surfaceAlt,
                    justifyContent: 'center',
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Txt v="button" color="text">{marked ? TL.marked : TL.mark}</Txt>
                </Pressable>
              </View>
              <Txt v="meta" color="muted" style={{ fontSize: 11 }}>{TL.previewSource}</Txt>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Corpo do modo de confirmação: nada aqui navega; só "Ler no texto" (via onRead) e "Fechar". */
function ConfirmBody({
  event,
  title,
  verse,
  onRead,
  onClose,
}: {
  event: TimelineLineEvent;
  title: string;
  verse: string | null;
  onRead: () => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const books = useBooks();
  const peopleNames = [...new Set(event.participants.map((p) => p.name).filter(Boolean))];
  const trPeople = useTimelineTexts(peopleNames);
  return (
    <ScrollView contentContainerStyle={{ gap: space[5] }} showsVerticalScrollIndicator={false}>
      <Txt v="sheetTitle" accessibilityRole="header">{title}</Txt>
      <Txt v="meta" color="muted">{`${eventYear(event)} · ${refShort(event.first_vid, event.last_vid, books, true)}`}</Txt>
      {peopleNames.length > 0 && (
        <View style={{ gap: space[3] }}>
          <Txt v="eyebrow" color="muted">{TL.people}</Txt>
          <Txt v="meta" color="text">{peopleNames.map(trPeople).join(', ')}</Txt>
        </View>
      )}
      {verse ? (
        <View style={{ gap: space[3] }}>
          <Txt v="eyebrow" color="muted">{TL.verseStart}</Txt>
          <Txt v="excerpt" numberOfLines={4}>{verse}</Txt>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
        <Pressable
          testID="tl-read"
          accessibilityRole="button"
          onPress={() => {
            onClose();
            onRead();
          }}
          style={({ pressed }) => ({
            minHeight: 44,
            paddingHorizontal: space[8],
            borderRadius: radius.lg,
            backgroundColor: c.accent,
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Txt v="button" tint={c.accentText}>{TL.readInText}</Txt>
        </Pressable>
        <Pressable
          testID="tl-close"
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => ({
            minHeight: 44,
            paddingHorizontal: space[8],
            borderRadius: radius.lg,
            backgroundColor: c.surfaceAlt,
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Txt v="button" color="text">{TL.close}</Txt>
        </Pressable>
      </View>
      <Txt v="meta" color="muted" style={{ fontSize: 11 }}>{TL.previewSource}</Txt>
    </ScrollView>
  );
}
