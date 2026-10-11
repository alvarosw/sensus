// Cards de fontes por tipo (proto: wordCard, comCard, xrCard, dicCard, placeCard, matrix).
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import {
  formatShortRef,
  titleCaseHeadword,
  type Book,
  type DictionaryEntry,
  type Entity,
  type Token,
  type XRef,
} from '@sensus/core';
import {
  Card,
  CardTop,
  EditionBadge,
  fontFamilies,
  LinkButton,
  MeterBar,
  MorphPill,
  radius,
  Tag,
  Txt,
  TypeMark,
  space,
  useTheme,
} from '@/design';
import { ScriptText } from '../rich/ScriptText';
import { useAutoTranslate } from '@/translate/useAutoTranslate';
import { AutoTranslateNote } from '@/translate/AutoTranslateNote';
import { useSourceLang } from '@/translate/source-lang';
import { useStudy } from '@/state/study';
import { bareWord, chv, isOldTestament, morphLabelsPt, refShort, type CommentaryView, type KeyWord } from './format';
import { STUDY } from './strings';

// ---- palavra -----------------------------------------------------------------------------------------

export const WordCard = memo(function WordCard({
  word,
  books,
  onOpen,
  onAsk,
}: {
  word: KeyWord;
  books: readonly Book[];
  onOpen: () => void;
  onAsk: () => void;
}) {
  const { c, st } = useTheme();
  const t = word.token;
  const lemma = word.lexicon?.lemma ?? t.lemma ?? bareWord(t.surface);
  const translit = word.lexicon?.translit ?? t.translit;
  const gloss = word.lexicon?.gloss ?? t.gloss_en;
  const ot = isOldTestament(word.strongBase);
  const n = word.count;
  const value = Math.min(1, Math.max(0.06, Math.log(n + 1) / Math.log(120)));
  const morph = morphLabelsPt(t.morph_desc);
  return (
    <Card testID={`word-${t.cite_id}`}>
      <CardTop>
        <TypeMark kind="tok" label={STUDY.word} />
        <Txt v="meta" color="muted">{`${refShort(t.vid, t.vid, books, true)} · ${word.strongBase}`}</Txt>
      </CardTop>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[5] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="lemma">{lemma}</Txt>
          <Txt v="meta" color="muted" style={{ fontFamily: fontFamilies.ui, fontSize: 12, lineHeight: 17 }}>
            {[translit, gloss ? `“${gloss}” (en)` : null].filter(Boolean).join(' · ')}
            {` · ${STUDY.inText}: `}
            <Txt v="greek" color="muted" style={{ fontSize: 14 }}>{bareWord(t.surface)}</Txt>
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          {n === 1 && <Tag tone="warn" label={STUDY.hapax} />}
          <Txt v="meta" color="muted" style={{ fontSize: 11, fontVariant: ['tabular-nums'] }}>
            {`${n} ${n === 1 ? 'versículo' : 'vv.'} no ${ot ? 'AT' : 'NT'}`}
          </Txt>
          <MeterBar value={value} color={st.tok} />
        </View>
      </View>
      {morph.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {morph.map((m, i) => (
            <MorphPill key={`${m}-${i}`} label={m} />
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: 2 }}>
        <LinkButton label={STUDY.lexiconConcordance} onPress={onOpen} testID={`word-open-${t.cite_id}`} />
        <LinkButton label={STUDY.ask} onPress={onAsk} testID={`word-ask-${t.cite_id}`} />
      </View>
    </Card>
  );
});

// ---- variante -------------------------------------------------------------------------------------------

export function VariantCard({
  vid,
  readings,
  books,
  onAnalyze,
  onAsk,
}: {
  vid: number;
  readings: { editions: string[]; text: string }[];
  books: readonly Book[];
  onAnalyze: () => void;
  onAsk: () => void;
}) {
  return (
    <Card testID={`variant-${vid}`}>
      <CardTop>
        <TypeMark kind="tok" label={STUDY.variantType} />
        <Txt v="meta" color="muted">{refShort(vid, vid, books, true)}</Txt>
      </CardTop>
      <View style={{ gap: space[2] }}>
        {readings.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 3, minWidth: 98 }}>
              {r.editions.map((e) => (
                <EditionBadge key={e} edition={e} />
              ))}
            </View>
            {r.text ? (
              <Txt v="greek" style={{ fontSize: 17, flex: 1 }}>{r.text}</Txt>
            ) : (
              <Txt v="meta" color="muted" italic style={{ fontStyle: 'italic', fontFamily: fontFamilies.ui }}>{STUDY.omits}</Txt>
            )}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <LinkButton label={STUDY.analyzeWord} onPress={onAnalyze} />
        <LinkButton label={STUDY.ask} onPress={onAsk} />
      </View>
    </Card>
  );
}

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
        <Txt v="bodySm" bold>{entity.name}</Txt>
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

// ---- lugar com mini-mapa ----------------------------------------------------------------------------------------

const MAP = 92;
const DEG = 60; // px por grau (escala regional)

function MiniMap({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const { c, st } = useTheme();
  const grid = 15;
  // A grade acompanha as coordenadas: lugares diferentes ficam sobre linhas diferentes.
  const offX = (((-lon * DEG) % grid) + grid) % grid;
  const offY = (((lat * DEG) % grid) + grid) % grid;
  const lines = [0, 1, 2, 3, 4, 5, 6].map((i) => i * grid);
  const x = MAP / 2;
  const y = MAP / 2;
  return (
    <View style={{ width: MAP, height: MAP, borderRadius: radius.lg, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      <Svg width={MAP} height={MAP} viewBox={`0 0 ${MAP} ${MAP}`} accessibilityLabel={`Posição de ${name}`}>
        <G stroke={c.border} strokeWidth={1}>
          {lines.map((g) => (
            <Line key={`v${g}`} x1={g + offX} y1={0} x2={g + offX} y2={MAP} />
          ))}
          {lines.map((g) => (
            <Line key={`h${g}`} x1={0} y1={g + offY} x2={MAP} y2={g + offY} />
          ))}
        </G>
        <Circle cx={x} cy={y} r={9} fill={st.ent} fillOpacity={0.25} />
        <Circle cx={x} cy={y} r={4} fill={st.ent} />
        <SvgText x={x} y={y - 12} textAnchor="middle" fontSize={9} fontWeight="700" fill={c.text}>
          {name.length > 14 ? `${name.slice(0, 13)}…` : name}
        </SvgText>
      </Svg>
    </View>
  );
}

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
        <MiniMap lat={entity.lat} lon={entity.lon} name={entity.name} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <CardTop>
            <TypeMark kind="ent" label={STUDY.place} />
            <Txt v="meta" color="muted">{sourceShort}</Txt>
          </CardTop>
          <Txt v="body" bold>{entity.name}</Txt>
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

// ---- referência cruzada ---------------------------------------------------------------------------------------------

export function XrefCard({
  xref,
  text,
  relevance,
  books,
  onPin,
  onAsk,
}: {
  xref: XRef;
  text: string;
  /** 0..1 */
  relevance: number;
  books: readonly Book[];
  onPin: () => void;
  onAsk: () => void;
}) {
  const { st } = useTheme();
  const textSource = useStudy((s) => s.textSource);
  const tr = useAutoTranslate(text || null, useSourceLang(textSource));
  const dest = formatShortRef(xref.to_start_vid, xref.to_end_vid, books as Book[], true);
  return (
    <Card testID={`xref-${xref.cite_id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
        <TypeMark kind="xr" label={STUDY.xrefType} />
        <Txt v="body" bold tint={st.xr} style={{ fontSize: 13.5, flexShrink: 1 }}>{dest}</Txt>
        <Txt v="meta" color="muted" style={{ fontSize: 11.5 }}>{`${STUDY.from} ${chv(xref.from_vid)}`}</Txt>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <MeterBar value={relevance} color={st.xr} width={44} height={5} />
          <Txt v="meta" color="muted" style={{ fontSize: 10.5 }}>{Math.round(xref.weight ?? 0)}</Txt>
        </View>
      </View>
      {text ? <Txt v="excerpt" numberOfLines={3}>{tr.display}</Txt> : null}
      {text ? <AutoTranslateNote tr={tr} testID={`xref-tr-${xref.cite_id}`} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <LinkButton label={STUDY.pinSideBySide} onPress={onPin} testID={`xref-pin-${xref.cite_id}`} />
        <LinkButton label={STUDY.ask} onPress={onAsk} />
      </View>
    </Card>
  );
}

// ---- comentário ----------------------------------------------------------------------------------------------------

export const CommentaryCard = memo(function CommentaryCard({
  view,
  refText,
  tokenByKey,
  authorFiltered,
  onOpen,
  onMoreByAuthor,
  onAsk,
}: {
  view: CommentaryView;
  refText: string;
  tokenByKey: ReadonlyMap<string, string>;
  authorFiltered: boolean;
  onOpen: () => void;
  onMoreByAuthor: () => void;
  onAsk: () => void;
}) {
  const tr = useAutoTranslate(view.body, useSourceLang(view.commentary.source_id));
  return (
    <Card testID={`com-${view.commentary.cite_id}`}>
      <CardTop>
        <TypeMark kind="com" label={STUDY.commentary} />
        <Txt v="bodySm" bold>{view.author}</Txt>
        {view.tradition ? <Tag label={view.tradition} /> : null}
        <Txt v="meta" color="muted" style={{ fontSize: 11.5 }}>{refText}</Txt>
      </CardTop>
      {tr.translated ? (
        <Txt v="excerpt" numberOfLines={4}>{tr.display}</Txt>
      ) : (
        <ScriptText text={view.body} numberOfLines={4} tokenByKey={tokenByKey} />
      )}
      <AutoTranslateNote tr={tr} testID={`com-tr-${view.commentary.cite_id}`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <LinkButton label={STUDY.readFull} onPress={onOpen} testID={`com-open-${view.commentary.cite_id}`} />
        <LinkButton label={authorFiltered ? STUDY.clearAuthor : STUDY.moreByAuthor} onPress={onMoreByAuthor} />
        <LinkButton label={STUDY.ask} onPress={onAsk} />
      </View>
    </Card>
  );
});

// ---- matriz "quem comenta cada versículo" ------------------------------------------------------------------------

const CELL_W = 24;
const CELL_H = 20;
const HEAD_H = 78;

export function CommentaryMatrix({
  rows,
  cols,
  hit,
  onPress,
}: {
  rows: { vid: number; label: string }[];
  cols: { key: string; label: string }[];
  hit: (vid: number, col: string) => { citeId: string; span: boolean; label: string } | undefined;
  onPress: (citeId: string) => void;
}) {
  const { c, st } = useTheme();
  const body = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        cells: cols.map((col) => hit(r.vid, col.key)),
      })),
    [rows, cols, hit],
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={STUDY.matrixLabel}>
      <View testID="matrix" style={{ gap: 3 }}>
        <View style={{ flexDirection: 'row', gap: 3, height: HEAD_H }}>
          <View style={{ width: 36 }} />
          {cols.map((col) => (
            <View key={col.key} style={{ width: CELL_W, height: HEAD_H }}>
              <View style={{ position: 'absolute', width: HEAD_H, height: CELL_W, left: (CELL_W - HEAD_H) / 2, top: (HEAD_H - CELL_W) / 2, transform: [{ rotate: '-90deg' }], justifyContent: 'center' }}>
                <Txt v="meta" color="muted" numberOfLines={1} style={{ fontSize: 10.5, fontFamily: fontFamilies.uiBold }}>{col.label}</Txt>
              </View>
            </View>
          ))}
        </View>
        {body.map((r) => (
          <View key={r.vid} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
            <View style={{ width: 36 }}>
              <Txt v="meta" color="muted" style={{ fontSize: 10.5, fontFamily: fontFamilies.uiBold }}>{r.label}</Txt>
            </View>
            {r.cells.map((cell, i) => (
              <View key={cols[i]!.key} style={{ width: CELL_W, height: CELL_H, borderRadius: 5, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
                {cell && (
                  <Pressable
                    testID={`matrix-${r.vid}-${cols[i]!.key}`}
                    accessibilityLabel={cell.label}
                    onPress={() => onPress(cell.citeId)}
                    hitSlop={2}
                    style={{ flex: 1, backgroundColor: st.com, opacity: cell.span ? 0.45 : 0.85 }}
                  />
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ---- filtro de tradição --------------------------------------------------------------------------------------------

export function FilterPill({ label, on, onPress, testID }: { label: string; on: boolean; onPress: () => void; testID?: string }) {
  const { c, st } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: on ? st.com : c.border,
        backgroundColor: on ? `${st.com}1A` : c.surface,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Txt v="meta" tint={on ? st.com : c.muted} style={{ fontSize: 12 }}>{label}</Txt>
    </Pressable>
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

export type { Token };
