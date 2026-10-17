// Lente Literário: vizinhança do trecho, divisões do original e introdução do livro.
import { Pressable, Text, View } from 'react-native';
import { splitVid, titleCaseHeadword, type Vid } from '@sensus/core';
import { Card, Empty, fontFamilies, Tag, Txt, SubHeader, space, useTheme } from '@/design';
import { useStudy } from '@/state/study';
import { chv, refShort } from '@/features/common/format';
import { DictionaryCard } from '../cards';
import { STUDY } from '../strings';
import { useStudyData } from '../useStudyData';
import { literaryNeighborhood, passageDivisions } from '../lens-model';
import { LensShell } from '../LensShell';
import { Body, Cards, SECTION_LABEL, SHOWN, attachCard, shortOf, useExpanded, type LensProps } from './shared';

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
          const { before, after } = literaryNeighborhood(lit, range);
          const first = p.layers.text.translations.find((v) => v.vid === range.start && v.source_id === 'blivre') ?? p.layers.text.translations.find((v) => v.vid === range.start);
          const divs = passageDivisions(lit.divisions, range);
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
