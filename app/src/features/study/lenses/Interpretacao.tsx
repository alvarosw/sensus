// Lente Interpretação: comentários por tradição e autor, matriz de versículos × autores e filtros.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { isIntroVid, type Commentary } from '@sensus/core';
import { Empty, LinkButton, SubHeader, Txt, space } from '@/design';
import { useStudy } from '@/state/study';
import { chv, refShort } from '@/features/common/format';
import { CommentaryCard, CommentaryMatrix, FilterPill } from '../cards';
import { activeTraditionOf, commentaryHitIndex, commentaryMatrix, commentaryTraditions, filterCommentaries } from '../lens-model';
import { viewCommentary, type CommentaryView } from '../format';
import { LensShell } from '../LensShell';
import { STUDY } from '../strings';
import { useStudyData, type StudyData } from '../useStudyData';
import { Body, Cards, SECTION_LABEL, SHOWN, attachCard, useExpanded, type LensProps } from './shared';

function commentaryRef(c: Commentary, books: StudyData['books']): string {
  return refShort(isIntroVid(c.start_vid) ? c.start_vid + 1 : c.start_vid, c.end_vid, books);
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
  const traditions = useMemo(() => commentaryTraditions(views), [views]);
  const activeTradition = activeTraditionOf(tradition);
  const filtered = useMemo(() => filterCommentaries(views, activeTradition, author), [views, activeTradition, author]);
  const shown = expanded ? filtered : filtered.slice(0, SHOWN);
  const matrix = useMemo(() => commentaryMatrix(views, range), [views, range]);
  const hit = useMemo(() => commentaryHitIndex(views), [views]);

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
