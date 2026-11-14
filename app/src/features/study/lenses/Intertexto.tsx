// Lente Intertexto: referências cruzadas do trecho (com peso relativo) e tópicos que o citam.
import { View } from 'react-native';
import { headwordShortText, type DictionaryEntry, type NameFields } from '@sensus/core';
import { useLang } from '@/i18n';
import { Empty, SubHeader, space } from '@/design';
import { useStudy } from '@/state/study';
import { chv, refShort } from '@/features/common/format';
import { AutoTranslateNote } from '@/translate/AutoTranslateNote';
import { useShortTexts } from '@/translate/useShortTexts';
import { TopicTag, XrefCard } from '../cards';
import { LensShell } from '../LensShell';
import { STUDY } from '../strings';
import { useStudyData } from '../useStudyData';
import { Body, Cards, SECTION_LABEL, SHOWN, attachCard, useExpanded, type LensProps } from './shared';

/** Tópicos que citam o trecho: rótulos em um lote de tradução e uma nota abaixo dos chips. */
function TopicList({ topics, names }: { topics: readonly DictionaryEntry[]; names: readonly NameFields[] }) {
  const appLang = useLang();
  const items = topics.map((tp) => headwordShortText(tp.headword, tp.source_id, names, appLang));
  const st = useShortTexts(items);
  if (topics.length === 0) return null;
  return (
    <>
      <SubHeader label={STUDY.topics} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        {topics.map((tp, i) => (
          <TopicTag key={tp.cite_id} label={st.view(items[i])!.text} onPress={() => useStudy.getState().openPopover(tp.cite_id)} />
        ))}
      </View>
      <AutoTranslateNote tr={st.note} testID="topics-tr" />
    </>
  );
}

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
      count={panel ? STUDY.xrefsCount(xrefs.length) : undefined}
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
              <TopicList topics={topics} names={p.layers.historical.entities} />
            </View>
          );
        }}
      </Body>
    </LensShell>
  );
}
