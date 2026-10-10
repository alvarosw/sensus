// As oito lentes da folha (proto: renderLenses). Cada uma = LensShell + conteúdo determinístico do banco
// formatado por tipo (catálogo em docs/DESIGN_SYSTEM.md).
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import {
  hasEdition,
  splitVid,
  titleCaseHeadword,
  variantSites,
  SECTION_LABELS,
  type Commentary,
  type Entity,
  type PanelData,
  type Token,
  type Vid,
} from '@sensus/core';
import {
  Empty,
  fontFamilies,
  LinkButton,
  Segmented,
  Skeleton,
  SubHeader,
  Tag,
  Txt,
  space,
  Greek,
  useTheme,
  Card,
} from '@/design';
import { useStudy, type LensKey } from '@/state/study';
import {
  CommentaryCard,
  CommentaryMatrix,
  DictionaryCard,
  EntityCard,
  FilterPill,
  PlaceCard,
  TopicTag,
  VariantCard,
  WordCard,
  XrefCard,
} from './cards';
import { LensShell } from './LensShell';
import { bareWord, chv, keyWordsOf, refShort, traditionLabel, viewCommentary, type CommentaryView } from './format';
import { STUDY } from './strings';
import { useStudyData, type StudyData } from './useStudyData';

export interface LensProps {
  onLayout?: (e: LayoutChangeEvent) => void;
}

const SHOWN = 3;

// ---- utilidades ---------------------------------------------------------------------------------------

const SOURCE_SHORT: Record<string, string> = {
  'sword-isbe': 'ISBE',
  'sword-easton': 'Easton',
  'sword-smith': 'Smith',
  'sword-hitchcock': 'Hitchcock',
  'sword-nave': 'Nave',
  'sword-torrey': 'Torrey',
  theographic: 'Theographic',
  'openbible-geo': 'OpenBible',
  'stepbible-tipnr': 'TIPNR',
  'openbible-xref': 'OpenBible',
  'sword-tsk': 'TSK',
};

function shortOf(panel: PanelData, sourceId: string): string {
  return SOURCE_SHORT[sourceId] ?? panel.sources[sourceId]?.title.split(/[\s(,]/)[0] ?? sourceId;
}

function attachCard(id: string, label: string, text?: string, citeIds?: string[]) {
  const st = useStudy.getState();
  st.attach({ id, kind: 'card', label, citeIds: citeIds ?? [id], text });
  st.openChat();
}

function useExpanded(lens: string): boolean {
  return useStudy((s) => !!s.expanded[lens]);
}

function Cards({ children }: { children: ReactNode }) {
  return <View style={{ gap: space[4] }}>{children}</View>;
}

function Loading({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (error) {
    return (
      <View style={{ gap: space[3] }}>
        <Txt v="bodySm" color="danger">{STUDY.panelError}</Txt>
        <View style={{ flexDirection: 'row' }}>
          <LinkButton label={STUDY.retry} onPress={onRetry} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: space[4] }}>
      <Skeleton width="60%" />
      <Skeleton width="90%" height={48} />
    </View>
  );
}

/** Corpo carregando/erro; senão, children(panel). */
function Body({ data, children }: { data: StudyData; children: (panel: PanelData) => ReactNode }) {
  if (!data.panel) return <Loading error={data.error} onRetry={data.reload} />;
  return <>{children(data.panel)}</>;
}

function selectionVids(panel: PanelData, range: { start: Vid; end: Vid }): Vid[] {
  const set = new Set<Vid>();
  for (const v of panel.layers.text.translations) if (v.vid >= range.start && v.vid <= range.end) set.add(v.vid);
  return [...set].sort((a, b) => a - b);
}

// ---- Visão geral ---------------------------------------------------------------------------------------

export function VisaoLens({ onLayout }: LensProps) {
  return <LensShell lens="visao" title={SECTION_LABEL.visao} count={STUDY.lensCount.visao} onLayout={onLayout} />;
}

const SECTION_LABEL: Record<LensKey, string> = {
  visao: 'Visão geral',
  texto: SECTION_LABELS.texto,
  literario: SECTION_LABELS.literario,
  historico: SECTION_LABELS.historico,
  lingua: SECTION_LABELS.lingua,
  intertexto: SECTION_LABELS.intertexto,
  interpretacao: SECTION_LABELS.interpretacao,
  aplicacao: SECTION_LABELS.aplicacao,
};

// ---- Texto -----------------------------------------------------------------------------------------------

function VerseNo({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontFamily: fontFamilies.uiBold, fontSize: 10, color: undefined }}>{children}</Text>
  );
}

function CompareText({ panel, range, vids }: { panel: PanelData; range: { start: Vid; end: Vid }; vids: Vid[] }) {
  const { c } = useTheme();
  const compare = useStudy((s) => s.compare);
  const pushPanel = useStudy((s) => s.pushPanel);
  const expanded = useStudy((s) => !!s.expanded['texto-cmp']);
  const toggle = useStudy((s) => s.toggleExpanded);
  const shown = expanded ? vids : vids.slice(0, 8);

  const byVid = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of panel.layers.text.translations) m.set(`${v.source_id}:${v.vid}`, v.text);
    return m;
  }, [panel]);
  const trTokens = useMemo(() => {
    const m = new Map<Vid, Token[]>();
    for (const t of panel.layers.text.original) {
      if (t.corpus !== 'gnt' || !hasEdition(t, 'TR')) continue;
      const list = m.get(t.vid) ?? [];
      list.push(t);
      m.set(t.vid, list);
    }
    return m;
  }, [panel]);

  return (
    <View style={{ gap: space[3] }} testID="compare">
      {shown.map((v) => {
        const label = <Text style={{ fontFamily: fontFamilies.uiBold, fontSize: 10, color: c.muted }}>{`${chv(v)}  `}</Text>;
        if (compare === 'tr') {
          const toks = trTokens.get(v);
          return (
            <Txt key={v} v="excerpt" style={{ fontSize: 14.5, lineHeight: 23 }}>
              {label}
              {toks && toks.length > 0
                ? toks.map((t, i) => (
                    <Greek key={t.cite_id} base="excerpt" onPress={() => pushPanel({ kind: 'word', tokenCiteId: t.cite_id })}>
                      {`${bareWord(t.surface)}${i < toks.length - 1 ? ' ' : ''}`}
                    </Greek>
                  ))
                : '—'}
            </Txt>
          );
        }
        const text = byVid.get(`${compare}:${v}`) ?? '—';
        return (
          <Txt key={v} v="excerpt" style={{ fontSize: 14.5, lineHeight: 23 }}>
            {label}
            {text}
          </Txt>
        );
      })}
      {vids.length > 8 && (
        <View style={{ flexDirection: 'row' }}>
          <LinkButton label={expanded ? STUDY.seeLess : `${STUDY.seeAll} ${vids.length}`} onPress={() => toggle('texto-cmp')} />
        </View>
      )}
      {compare === 'tr' && <Txt v="meta" color="muted" style={{ fontSize: 11 }}>{STUDY.cmpHint}</Txt>}
    </View>
  );
}

export function TextoLens({ onLayout }: LensProps) {
  const data = useStudyData();
  const compare = useStudy((s) => s.compare);
  const setCompare = useStudy((s) => s.setCompare);
  const expanded = useExpanded('texto');
  const { panel, range, books } = data;
  const sites = useMemo(() => (panel ? variantSites(panel.layers.text.original) : []), [panel]);
  const vids = useMemo(() => (panel ? selectionVids(panel, range) : []), [panel, range]);
  const shown = expanded ? sites : sites.slice(0, 2);
  const st = useStudy.getState;

  return (
    <LensShell
      lens="texto"
      title={SECTION_LABEL.texto}
      count={panel ? `${vids.length} vv · ${sites.length} ${sites.length === 1 ? 'variante' : 'variantes'}` : undefined}
      sourcesN={sites.length > 2 ? sites.length : 0}
      onLayout={onLayout}
    >
      <Body data={data}>
        {(p) => (
          <View style={{ gap: space[6] }}>
            <SubHeader label={STUDY.translations} />
            <Segmented
              testID="compare-seg"
              value={compare}
              onChange={setCompare}
              options={[
                { key: 'blivre', label: STUDY.cmpBlivre },
                { key: 'kjv', label: STUDY.cmpKjv },
                { key: 'tr', label: STUDY.cmpTr },
              ]}
            />
            <CompareText panel={p} range={range} vids={vids} />
            <SubHeader label={STUDY.variantsTitle} />
            {shown.length === 0 ? (
              <Empty text={STUDY.variantsEmpty} />
            ) : (
              <Cards>
                {shown.map((s) => {
                  const readings = s.readings.map((r) => ({ editions: r.editions, text: r.tokens.map((t) => bareWord(t.surface)).join(' ') }));
                  const first = s.readings.find((r) => r.tokens.length > 0)?.tokens[0];
                  const label = `Variante ${chv(s.vid)}: ${readings.map((r) => r.text || 'omite').join(' × ')}`;
                  return (
                    <VariantCard
                      key={`${s.vid}-${s.readings[0]?.tokens[0]?.pos ?? s.readings[1]?.tokens[0]?.pos ?? 0}`}
                      vid={s.vid}
                      readings={readings}
                      books={books}
                      onAnalyze={() => first && st().pushPanel({ kind: 'word', tokenCiteId: first.cite_id })}
                      onAsk={() => {
                        const ids = s.readings.flatMap((r) => r.tokens.map((t) => t.cite_id));
                        const store = st();
                        store.attach({ id: `var:${s.vid}:${s.readings[0]?.tokens[0]?.pos ?? 0}`, kind: 'variant', label, citeIds: ids });
                        store.openChat();
                      }}
                    />
                  );
                })}
              </Cards>
            )}
          </View>
        )}
      </Body>
    </LensShell>
  );
}

// ---- Literário ----------------------------------------------------------------------------------------------

function ContextVerse({ vid, text, selected, onInclude }: { vid: Vid | string; text: string; selected?: boolean; onInclude?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, backgroundColor: selected ? c.selected : 'transparent' }}>
      <Txt v="excerpt" color={selected ? 'text' : 'muted'} style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 20 }}>
        <Text style={{ fontFamily: fontFamilies.uiBold, fontSize: 10.5, color: c.muted }}>{`${typeof vid === 'number' ? chv(vid) : vid}  `}</Text>
        {text}
      </Txt>
      {onInclude && (
        <Pressable
          testID={`include-${vid}`}
          accessibilityRole="button"
          onPress={onInclude}
          style={({ pressed }) => ({ borderWidth: 1, borderStyle: 'dashed', borderColor: c.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, opacity: pressed ? 0.6 : 1 })}
        >
          <Txt v="meta" color="accent" bold style={{ fontSize: 11.5 }}>{STUDY.include}</Txt>
        </Pressable>
      )}
    </View>
  );
}

export function LiterarioLens({ onLayout }: LensProps) {
  const data = useStudyData();
  const expanded = useExpanded('literario');
  const { range, books, tokenByKey } = data;
  const setSelection = useStudy((s) => s.setSelection);

  return (
    <LensShell lens="literario" title={SECTION_LABEL.literario} onLayout={onLayout} sourcesN={0}>
      <Body data={data}>
        {(p) => {
          const lit = p.layers.literary;
          const before = lit.before.filter((v) => v.vid < range.start).slice(-2);
          const after = lit.after.filter((v) => v.vid > range.end).slice(0, 2);
          const first = p.layers.text.translations.find((v) => v.vid === range.start && v.source_id === 'blivre') ?? p.layers.text.translations.find((v) => v.vid === range.start);
          const divs = lit.divisions.filter((d) => d.vid >= range.start && d.vid <= range.end);
          const divShown = expanded ? divs : divs.slice(0, SHOWN);
          const intro = expanded ? lit.bookIntro : lit.bookIntro.slice(0, 1);
          const include = (v: Vid) => setSelection(Math.min(v, range.start), Math.max(v, range.end));
          return (
            <View style={{ gap: space[6] }}>
              <SubHeader label={STUDY.neighborhood} />
              <View style={{ gap: 2 }} testID="ctx-strip">
                {before.map((v) => (
                  <ContextVerse key={v.cite_id} vid={v.vid} text={v.text} onInclude={() => include(v.vid)} />
                ))}
                <ContextVerse
                  vid={refShort(range.start, range.end, books)}
                  text={first ? `${first.text.slice(0, 70)}…` : ''}
                  selected
                />
                {after.map((v) => (
                  <ContextVerse key={v.cite_id} vid={v.vid} text={v.text} onInclude={() => include(v.vid)} />
                ))}
              </View>
              {divs.length > 0 && (
                <>
                  <SubHeader label={STUDY.divisions} />
                  <Cards>
                    {divShown.map((d) => (
                      <Card key={`${d.vid}-${d.kind}`}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' }}>
                          <Tag label={STUDY.division} tone="tint" />
                          <Txt v="meta" color="muted">{`${p.sources[d.source_id]?.title ?? d.source_id} · ${refShort(d.vid, d.vid, books, true)}`}</Txt>
                        </View>
                        <Txt v="bodySm">
                          {d.title ?? `${d.kind === 'heading' ? STUDY.heading : STUDY.paragraphStart} ${splitVid(d.vid).verse === 1 ? `(capítulo ${splitVid(d.vid).chapter})` : ''}`.trim()}
                        </Txt>
                      </Card>
                    ))}
                  </Cards>
                </>
              )}
              {intro.length > 0 && (
                <>
                  <SubHeader label={STUDY.bookIntro} />
                  <Cards>
                    {intro.map((e) => (
                      <DictionaryCard
                        key={e.cite_id}
                        entry={e}
                        sourceShort={shortOf(p, e.source_id)}
                        tokenByKey={tokenByKey}
                        onOpen={() => useStudy.getState().pushPanel({ kind: 'source', citeId: e.cite_id })}
                        onAsk={() => attachCard(e.cite_id, `${shortOf(p, e.source_id)}: ${titleCaseHeadword(e.headword)}`)}
                      />
                    ))}
                  </Cards>
                </>
              )}
              {divs.length === 0 && lit.bookIntro.length === 0 && before.length + after.length === 0 && <Empty text="Sem contexto literário nesta fonte." />}
            </View>
          );
        }}
      </Body>
    </LensShell>
  );
}

// ---- Histórico -----------------------------------------------------------------------------------------------

function dedupePlaces(entities: Entity[]): Array<Entity & { lat: number; lon: number }> {
  const seen = new Set<string>();
  const out: Array<Entity & { lat: number; lon: number }> = [];
  const rank = (e: Entity) => (e.source_id === 'theographic' ? 0 : e.source_id === 'openbible-geo' ? 1 : 2);
  for (const e of [...entities].sort((a, b) => rank(a) - rank(b))) {
    if (e.type !== 'place' || e.lat == null || e.lon == null) continue;
    const k = e.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e as Entity & { lat: number; lon: number });
  }
  return out;
}

export function HistoricoLens({ onLayout }: LensProps) {
  const data = useStudyData();
  const expanded = useExpanded('historico');
  const { panel, tokenByKey } = data;
  const parts = useMemo(() => {
    if (!panel) return null;
    const places = dedupePlaces(panel.layers.historical.entities);
    const placeNames = new Set(places.map((p) => p.name.toLowerCase()));
    const others = panel.layers.historical.entities.filter((e) => !placeNames.has(e.name.toLowerCase()) && !(e.type === 'place' && e.lat != null));
    const seen = new Set<string>();
    const people = others.filter((e) => {
      const k = e.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { places, people, dic: panel.layers.historical.dictionary };
  }, [panel]);
  const total = parts ? parts.people.length + parts.dic.length : 0;

  return (
    <LensShell
      lens="historico"
      title={SECTION_LABEL.historico}
      count={parts ? `${parts.places.length} ${parts.places.length === 1 ? 'lugar' : 'lugares'} · ${parts.dic.length} verbetes` : undefined}
      sourcesN={total > SHOWN ? total : 0}
      onLayout={onLayout}
    >
      <Body data={data}>
        {(p) => {
          if (!parts) return null;
          const places = expanded ? parts.places : parts.places.slice(0, 1);
          const people = expanded ? parts.people : parts.people.slice(0, 2);
          const dic = expanded ? parts.dic : parts.dic.slice(0, 2);
          if (parts.places.length + parts.people.length + parts.dic.length === 0) return <Empty text={STUDY.historicalEmpty} />;
          const open = (id: string) => useStudy.getState().pushPanel({ kind: 'entity', citeId: id });
          return (
            <View style={{ gap: space[6] }}>
              {places.length > 0 && (
                <>
                  <SubHeader label={places.length > 1 ? STUDY.places : STUDY.place} />
                  <Cards>
                    {places.map((e) => (
                      <PlaceCard
                        key={e.cite_id}
                        entity={e}
                        sourceShort={shortOf(p, e.source_id)}
                        onOpen={() => open(e.cite_id)}
                        onOthers={() => useStudy.getState().showToast({ text: STUDY.otherPassagesSoon })}
                      />
                    ))}
                  </Cards>
                </>
              )}
              {people.length > 0 && (
                <>
                  <SubHeader label={STUDY.peopleGroups} />
                  <Cards>
                    {people.map((e) => (
                      <EntityCard
                        key={e.cite_id}
                        entity={e}
                        sourceShort={shortOf(p, e.source_id)}
                        onOpen={() => open(e.cite_id)}
                        onAsk={() => attachCard(e.cite_id, e.name)}
                      />
                    ))}
                  </Cards>
                </>
              )}
              {dic.length > 0 && (
                <>
                  <SubHeader label={STUDY.dictionaries} />
                  <Cards>
                    {dic.map((e) => (
                      <DictionaryCard
                        key={e.cite_id}
                        entry={e}
                        sourceShort={shortOf(p, e.source_id)}
                        tokenByKey={tokenByKey}
                        onOpen={() => useStudy.getState().pushPanel({ kind: 'source', citeId: e.cite_id })}
                        onAsk={() => attachCard(e.cite_id, `${shortOf(p, e.source_id)}: ${titleCaseHeadword(e.headword)}`)}
                      />
                    ))}
                  </Cards>
                </>
              )}
            </View>
          );
        }}
      </Body>
    </LensShell>
  );
}

// ---- Língua ----------------------------------------------------------------------------------------------------

export function LinguaLens({ onLayout }: LensProps) {
  const data = useStudyData();
  const expanded = useExpanded('lingua');
  const { panel, books } = data;
  const words = useMemo(() => (panel ? keyWordsOf(panel) : []), [panel]);
  const shown = expanded ? words : words.slice(0, SHOWN);
  return (
    <LensShell
      lens="lingua"
      title={SECTION_LABEL.lingua}
      count={panel && words.length > 0 ? `${words.length} palavras-chave` : undefined}
      sourcesN={words.length > SHOWN ? words.length : 0}
      onLayout={onLayout}
    >
      <Body data={data}>
        {() =>
          words.length === 0 ? (
            <Empty text={STUDY.languageEmpty} />
          ) : (
            <Cards>
              {shown.map((w) => (
                <WordCard
                  key={w.strongBase}
                  word={w}
                  books={books}
                  onOpen={() => useStudy.getState().pushPanel({ kind: 'word', tokenCiteId: w.token.cite_id })}
                  onAsk={() => {
                    const st = useStudy.getState();
                    st.attach({ id: w.token.cite_id, kind: 'token', label: bareWord(w.token.surface), citeIds: [w.token.cite_id, ...(w.lexicon ? [w.lexicon.cite_id] : [])] });
                    st.openChat();
                  }}
                />
              ))}
            </Cards>
          )
        }
      </Body>
    </LensShell>
  );
}

// ---- Intertexto ----------------------------------------------------------------------------------------------------

export function IntertextoLens({ onLayout }: LensProps) {
  const data = useStudyData();
  const expanded = useExpanded('intertexto');
  const { panel, books } = data;
  const xrefs = panel?.layers.intertext.xrefs ?? [];
  const maxW = Math.max(1, ...xrefs.map((x) => x.weight ?? 0));
  const shown = expanded ? xrefs : xrefs.slice(0, SHOWN);
  return (
    <LensShell
      lens="intertexto"
      title={SECTION_LABEL.intertexto}
      count={panel ? `${xrefs.length} referências` : undefined}
      sourcesN={xrefs.length > SHOWN ? xrefs.length : 0}
      onLayout={onLayout}
    >
      <Body data={data}>
        {(p) => {
          const topics = p.layers.intertext.topics;
          return (
            <View style={{ gap: space[6] }}>
              {xrefs.length === 0 ? (
                <Empty text={STUDY.xrefsEmpty} />
              ) : (
                <Cards>
                  {shown.map((x) => {
                    const text = x.texts.map((t) => t.text).join(' ');
                    return (
                      <XrefCard
                        key={x.cite_id}
                        xref={x}
                        text={text}
                        relevance={(x.weight ?? 0) / maxW}
                        books={books}
                        onPin={() => {
                          const st = useStudy.getState();
                          st.pin({ citeId: x.cite_id, start: x.to_start_vid, end: x.to_end_vid });
                          if (st.detent === 'full') st.setDetent('half');
                          st.showToast({ text: STUDY.pinned(refShort(x.to_start_vid, x.to_end_vid, books, true)) });
                        }}
                        onAsk={() =>
                          attachCard(
                            x.cite_id,
                            `${chv(x.from_vid)} → ${refShort(x.to_start_vid, x.to_end_vid, books, true)}`,
                            text,
                            [x.cite_id, ...x.texts.map((t) => t.cite_id)],
                          )
                        }
                      />
                    );
                  })}
                </Cards>
              )}
              {topics.length > 0 && (
                <>
                  <SubHeader label={STUDY.topics} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
                    {topics.map((tp) => (
                      <TopicTag key={tp.cite_id} label={titleCaseHeadword(tp.headword)} onPress={() => useStudy.getState().openPopover(tp.cite_id)} />
                    ))}
                  </View>
                </>
              )}
            </View>
          );
        }}
      </Body>
    </LensShell>
  );
}

// ---- Interpretação --------------------------------------------------------------------------------------------------

function commentaryRef(c: Commentary, books: StudyData['books']): string {
  return refShort(c.start_vid % 1000 === 0 ? c.start_vid + 1 : c.start_vid, c.end_vid, books);
}

export function InterpretacaoLens({ onLayout }: LensProps) {
  const data = useStudyData();
  const expanded = useExpanded('interpretacao');
  const tradition = useStudy((s) => s.tradition);
  const setTradition = useStudy((s) => s.setTradition);
  const [author, setAuthor] = useState<string | null>(null);
  const { panel, range, books, tokenByKey } = data;

  const views = useMemo<CommentaryView[]>(
    () => (panel ? panel.layers.interpretation.commentaries.map((c) => viewCommentary(c, panel.sources[c.source_id])).filter((v) => !v.intro) : []),
    [panel],
  );
  const traditions = useMemo(() => [...new Set(views.map((v) => v.tradition).filter(Boolean))], [views]);
  const activeTradition = tradition && traditions.includes(traditionLabel(tradition)) ? traditionLabel(tradition) : tradition ? traditionLabel(tradition) : null;
  const filtered = useMemo(
    () => views.filter((v) => (!activeTradition || v.tradition === activeTradition) && (!author || v.author === author)),
    [views, activeTradition, author],
  );
  const shown = expanded ? filtered : filtered.slice(0, SHOWN);

  const matrix = useMemo(() => {
    const vids = [...new Set(views.flatMap((v) => {
      const out: Vid[] = [];
      for (let x = Math.max(v.commentary.start_vid, range.start); x <= Math.min(v.commentary.end_vid, range.end); x++) {
        if (x % 1000 === 0) continue;
        out.push(x);
        if (out.length > 60) break;
      }
      return out;
    }))].sort((a, b) => a - b);
    const cols: { key: string; label: string }[] = [];
    for (const v of views) if (!cols.some((c) => c.key === v.column)) cols.push({ key: v.column, label: v.column });
    return { vids: vids.slice(0, 24), cols: cols.slice(0, 9) };
  }, [views, range]);

  const hit = useMemo(() => {
    const index = new Map<string, CommentaryView>();
    for (const v of views) {
      for (let x = v.commentary.start_vid; x <= v.commentary.end_vid && x - v.commentary.start_vid < 80; x++) {
        const k = `${x}|${v.column}`;
        if (!index.has(k)) index.set(k, v);
      }
    }
    return (vid: number, col: string) => {
      const v = index.get(`${vid}|${col}`);
      return v
        ? { citeId: v.commentary.cite_id, span: v.commentary.start_vid !== v.commentary.end_vid, label: `${v.author} ${chv(vid)}` }
        : undefined;
    };
  }, [views]);

  return (
    <LensShell
      lens="interpretacao"
      title={SECTION_LABEL.interpretacao}
      count={panel ? `${views.length} comentários` : undefined}
      sourcesN={filtered.length > SHOWN ? filtered.length : 0}
      onLayout={onLayout}
    >
      <Body data={data}>
        {() =>
          views.length === 0 ? (
            <Empty text={STUDY.commentsEmpty} />
          ) : (
            <View style={{ gap: space[6] }}>
              <SubHeader label={STUDY.whoComments} />
              <CommentaryMatrix
                rows={matrix.vids.map((v) => ({ vid: v, label: chv(v) }))}
                cols={matrix.cols}
                hit={hit}
                onPress={(id) => useStudy.getState().openPopover(id)}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                <FilterPill testID="trad-all" label={STUDY.allTraditions} on={!activeTradition} onPress={() => setTradition(null)} />
                {traditions.map((t) => (
                  <FilterPill key={t} testID={`trad-${t}`} label={t} on={activeTradition === t} onPress={() => setTradition(activeTradition === t ? null : t)} />
                ))}
              </View>
              {author && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <Txt v="meta" color="muted">{STUDY.onlyAuthor(author)}</Txt>
                  <LinkButton label={STUDY.clearAuthor} onPress={() => setAuthor(null)} />
                </View>
              )}
              <Cards>
                {shown.map((v) => (
                  <CommentaryCard
                    key={v.commentary.cite_id}
                    view={v}
                    refText={commentaryRef(v.commentary, books)}
                    tokenByKey={tokenByKey}
                    authorFiltered={author === v.author}
                    onOpen={() => useStudy.getState().pushPanel({ kind: 'source', citeId: v.commentary.cite_id })}
                    onMoreByAuthor={() => setAuthor(author === v.author ? null : v.author)}
                    onAsk={() => attachCard(v.commentary.cite_id, `${v.author} ${commentaryRef(v.commentary, books)}`)}
                  />
                ))}
              </Cards>
            </View>
          )
        }
      </Body>
    </LensShell>
  );
}

// ---- Aplicação ---------------------------------------------------------------------------------------------------------

export function AplicacaoLens({ onLayout }: LensProps) {
  return <LensShell lens="aplicacao" title={SECTION_LABEL.aplicacao} count={STUDY.lensCount.aplicacao} onLayout={onLayout} />;
}

export const LENS_VIEWS: Record<LensKey, (p: LensProps) => ReactNode> = {
  visao: VisaoLens,
  texto: TextoLens,
  literario: LiterarioLens,
  historico: HistoricoLens,
  lingua: LinguaLens,
  intertexto: IntertextoLens,
  interpretacao: InterpretacaoLens,
  aplicacao: AplicacaoLens,
};

export { VerseNo };
