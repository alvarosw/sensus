// Cards de histórico e contexto: verbete e índice temático, entidade, lugar, etiqueta de tema e linha do tempo
// (proto: dicCard, placeCard, .tl). Cada card traduz o próprio texto quando a fonte está em outra língua.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  formatEventDate,
  shownEntityName,
  titleCaseHeadword,
  type Book,
  type DictionaryEntry,
  type Entity,
  type TimelineEvent,
} from '@sensus/core';
import { Card, CardTop, LinkButton, radius, size, space, Txt, TypeMark, useTheme } from '@/design';
import { ScriptText } from '@/features/rich';
import { refShort } from '@/features/common/format';
import { EventPreview } from '@/features/timeline';
import { useAutoTranslate } from '@/translate/useAutoTranslate';
import { AutoTranslateNote } from '@/translate/AutoTranslateNote';
import { TimelineTranslationNote } from '@/translate/TimelineTranslationNote';
import { useTimelineTexts } from '@/translate/timeline-translate';
import { useSourceLang } from '@/translate/source-lang';
import { STUDY } from '../strings';

// ---- verbete / índice / entidade ------------------------------------------------------------------------------

export function DictionaryCard({
  entry,
  sourceShort,
  topical,
  tokenByKey,
  onOpen,
  onAsk,
  lines = 4,
}: {
  entry: DictionaryEntry;
  sourceShort: string;
  topical?: boolean;
  tokenByKey: ReadonlyMap<string, string>;
  onOpen: () => void;
  onAsk: () => void;
  lines?: number;
}) {
  const tr = useAutoTranslate(entry.text, useSourceLang(entry.source_id));
  return (
    <Card testID={`dic-${entry.cite_id}`}>
      <CardTop>
        <TypeMark kind="dic" label={topical ? STUDY.topicIndex : STUDY.entry} />
        <Txt v="bodySm" bold>{titleCaseHeadword(entry.headword).split(',')[0]!}</Txt>
        <Txt v="meta" color="muted">{sourceShort}</Txt>
      </CardTop>
      {tr.translated ? (
        <Txt v="excerpt" numberOfLines={lines}>{tr.display}</Txt>
      ) : (
        <ScriptText text={entry.text} numberOfLines={lines} tokenByKey={tokenByKey} />
      )}
      <AutoTranslateNote tr={tr} testID={`dic-tr-${entry.cite_id}`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <LinkButton label={STUDY.readEntry} onPress={onOpen} />
        <LinkButton label={STUDY.ask} onPress={onAsk} />
      </View>
    </Card>
  );
}

export function EntityCard({
  entity,
  sourceShort,
  onOpen,
  onAsk,
}: {
  entity: Entity;
  sourceShort: string;
  onOpen: () => void;
  onAsk: () => void;
}) {
  const tr = useAutoTranslate(entity.description, useSourceLang(entity.source_id));
  return (
    <Card testID={`ent-${entity.cite_id}`}>
      <CardTop>
        <TypeMark kind="ent" label={STUDY.entityType[entity.type] ?? STUDY.entityType.other!} />
        <Txt v="bodySm" bold>{shownEntityName(entity, true).text}</Txt>
        <Txt v="meta" color="muted">{sourceShort}</Txt>
      </CardTop>
      {entity.description ? <Txt v="excerpt" numberOfLines={3}>{tr.display}</Txt> : null}
      {entity.description ? <AutoTranslateNote tr={tr} testID={`ent-tr-${entity.cite_id}`} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <LinkButton label={STUDY.seeEntity} onPress={onOpen} />
        <LinkButton label={STUDY.ask} onPress={onAsk} />
      </View>
    </Card>
  );
}

// ---- lugar (o mapa real fica em PassageMapCard e no painel de mapa) ----------------------------------------

export function PlaceCard({
  entity,
  sourceShort,
  onOpen,
  onOthers,
}: {
  entity: Entity & { lat: number; lon: number };
  sourceShort: string;
  onOpen: () => void;
  onOthers: () => void;
}) {
  const ns = entity.lat >= 0 ? 'N' : 'S';
  const ew = entity.lon >= 0 ? 'L' : 'O';
  const tr = useAutoTranslate(entity.description, useSourceLang(entity.source_id));
  return (
    <Card testID={`place-${entity.cite_id}`}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <CardTop>
            <TypeMark kind="ent" label={STUDY.place} />
            <Txt v="meta" color="muted">{sourceShort}</Txt>
          </CardTop>
          <Txt v="body" bold>{shownEntityName(entity, true).text}</Txt>
          <Txt v="mono" color="muted" style={{ fontSize: 11 }}>
            {`${Math.abs(entity.lat).toFixed(3)}° ${ns} · ${Math.abs(entity.lon).toFixed(3)}° ${ew}`}
          </Txt>
          {entity.description ? <Txt v="excerpt" numberOfLines={3} style={{ fontSize: 13 }}>{tr.display}</Txt> : null}
          {entity.description ? <AutoTranslateNote tr={tr} testID={`place-tr-${entity.cite_id}`} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            <LinkButton label={STUDY.seeEntity} onPress={onOpen} />
            <LinkButton label={STUDY.otherPassages} onPress={onOthers} />
          </View>
        </View>
      </View>
    </Card>
  );
}

// ---- linha do tempo (proto: .tl) -------------------------------------------------------------------------------------

/**
 * Eventos em ordem cronológica: ano à esquerda, ponto e título. Eventos do trecho têm ponto de destaque e rótulo;
 * os de contexto aparecem esmaecidos. Tocar leva a seleção e o leitor aos versículos do evento.
 */
export function TimelineCard({
  events,
  books,
  onRead,
  onOpenTimeline,
}: {
  events: readonly TimelineEvent[];
  books: readonly Book[];
  /** "Ler no texto" da prévia: seleciona e rola o leitor até os versículos do evento. */
  onRead: (first: number, last: number) => void;
  /** Abre a cronologia do trecho em tela cheia ("Abrir na linha do tempo"). */
  onOpenTimeline?: () => void;
}) {
  const { c, st } = useTheme();
  // Tocar num evento só abre a prévia; a leitura vem do botão "Ler no texto" (o toque pode ser acidental).
  const [preview, setPreview] = useState<string | null>(null);
  // Coluna do ano do tamanho do rótulo mais longo (mono: ~0,6 em por caractere), sem sobra à esquerda.
  const years = events.map((e) => formatEventDate(e.startDate) ?? '');
  const yearW = Math.ceil(Math.max(1, ...years.map((y) => y.length)) * 11 * 0.62);
  // Títulos da linha do tempo, traduzidos quando configurado (um lote para o cartão inteiro).
  const tr = useTimelineTexts(events.map((e) => e.title));
  return (
    <View style={{ gap: space[3] }}>
      <TimelineTranslationNote testID="timeline-note" />
      <Card testID="timeline">
        {/* Uma só área: o gap do Card separaria os pontos e cortaria o fio entre eles. */}
        <View>
          {events.map((e, i) => {
            const year = years[i]!;
            const reference = refShort(e.first_vid, e.last_vid, books, true);
            return (
              <Pressable
                key={e.cite_id}
                testID={`timeline-${e.cite_id}`}
                accessibilityRole="button"
                accessibilityLabel={`${tr(e.title)}, ${year}, ${reference}`}
                onPress={() => setPreview(e.cite_id)}
                hitSlop={4}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  gap: space[4],
                  minHeight: size.minTouch,
                  opacity: pressed ? 0.7 : e.inRange ? 1 : 0.55,
                })}
              >
                <Txt v="mono" color="muted" style={{ width: yearW, textAlign: 'right', fontSize: 11, lineHeight: 16, paddingTop: 1 }} numberOfLines={1}>
                  {year}
                </Txt>
                <View style={{ width: 18, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: e.inRange ? c.selected : 'transparent',
                    }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: e.inRange ? c.accent : st.ent }} />
                  </View>
                  {i < events.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: c.border, marginVertical: 2 }} />}
                </View>
                <View style={{ flex: 1, minWidth: 0, paddingBottom: space[5], gap: 2 }}>
                  <Txt v="bodySm" bold color={e.inRange ? 'text' : 'muted'} numberOfLines={2}>
                    {tr(e.title)}
                  </Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space[3] }}>
                    <Txt v="meta" color="muted" style={{ fontSize: 11 }}>{reference}</Txt>
                    {e.inRange && <Txt v="meta" color="accent" style={{ fontSize: 11 }}>{STUDY.timelineHere}</Txt>}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>
      {onOpenTimeline && <LinkButton label={STUDY.timelineOpen} onPress={onOpenTimeline} testID="timeline-open" />}
      {preview && <EventPreview citeId={preview} confirm={{ onRead }} onClose={() => setPreview(null)} />}
    </View>
  );
}
/** Etiqueta de tema (proto: .topic). */
export function TopicTag({ label, onPress }: { label: string; onPress: () => void }) {
  const { st } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: `${st.dic}24`, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 5, opacity: pressed ? 0.6 : 1 })}
    >
      <Txt v="meta" tint={st.dic} bold style={{ fontSize: 12 }}>{label}</Txt>
    </Pressable>
  );
}
