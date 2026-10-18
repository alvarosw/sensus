// Lente Histórico: linha do tempo do trecho, lugares (com mapa), pessoas e grupos, e verbetes de dicionário.
import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { shownEntityName, titleCaseHeadword } from '@sensus/core';
import { Empty, SubHeader, space } from '@/design';
import { useStudy } from '@/state/study';
import { useReaderNav } from '@/state/reader-nav';
import { PassageMapCard } from '@/features/maps';
import { DictionaryCard, EntityCard, PlaceCard, TimelineCard } from '../cards';
import { LensShell } from '../LensShell';
import { historicalParts } from '../lens-model';
import { STUDY } from '../strings';
import { useStudyData } from '../useStudyData';
import { Body, Cards, SECTION_LABEL, SHOWN, TIMELINE_SHOWN, attachCard, shortOf, useExpanded, type LensProps } from './shared';

export function HistoricoLens({ onLayout }: LensProps) {
  const data = useStudyData();
  const expanded = useExpanded('historico');
  const { panel, tokenByKey } = data;
  const parts = useMemo(() => (panel ? historicalParts(panel.layers.historical) : null), [panel]);
  const total = parts ? parts.people.length + parts.dic.length + parts.events.length : 0;

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
          const events = expanded ? parts.events : parts.events.slice(0, TIMELINE_SHOWN);
          if (parts.places.length + parts.people.length + parts.dic.length + parts.events.length === 0) {
            return <Empty text={STUDY.historicalEmpty} />;
          }
          const open = (id: string) => useStudy.getState().pushPanel({ kind: 'entity', citeId: id });
          // Só chamado pela prévia, em "Ler no texto": seleção nos versículos do evento e rolagem do leitor até eles.
          const readEvent = (first: number, last: number) => {
            useStudy.getState().setSelection(first, last);
            useReaderNav.getState().goVerse(first, { flash: true });
          };
          // Cronologia do livro do trecho em tela cheia (começa no evento do trecho).
          const openTimeline = () => {
            router.push({ pathname: '/timeline/contexto', params: { de: String(data.range.start), ate: String(data.range.end) } });
          };
          return (
            <View style={{ gap: space[6] }}>
              {events.length > 0 && (
                <>
                  <SubHeader label={STUDY.timeline} />
                  <TimelineCard events={events} books={data.books} onRead={readEvent} onOpenTimeline={openTimeline} />
                </>
              )}
              {places.length > 0 && <PassageMapCard range={data.range} unit={data.unit} />}
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
                        onAsk={() => attachCard(e.cite_id, shownEntityName(e, true).text)}
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
