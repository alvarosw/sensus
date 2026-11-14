// Lente Língua: palavras-chave do trecho (grego no NT, hebraico no AT), com léxico e concordância no painel da palavra.
import { useMemo } from 'react';
import { View } from 'react-native';
import { glossShortText } from '@sensus/core';
import { bareWord } from '@/features/common/format';
import { useStudy } from '@/state/study';
import { AutoTranslateNote } from '@/translate/AutoTranslateNote';
import { useShortTexts } from '@/translate/useShortTexts';
import { WordCard } from '../cards';
import { keyWordsOf } from '../format';
import { LensShell } from '../LensShell';
import { STUDY } from '../strings';
import { useStudyData } from '../useStudyData';
import { Body, Cards, SECTION_LABEL, SHOWN, useExpanded, type LensProps } from './shared';
import { Empty, space } from '@/design';

export function LinguaLens({ onLayout }: LensProps) {
  const data = useStudyData();
  const expanded = useExpanded('lingua');
  const { panel, books } = data;
  const words = useMemo(() => (panel ? keyWordsOf(panel) : []), [panel]);
  const shown = expanded ? words : words.slice(0, SHOWN);
  // Glosas dos cards mostrados: um lote de tradução e uma nota acima dos cards.
  const glosses = shown.map((w) => glossShortText({ lexicon: w.lexicon, tokenGloss: w.token.gloss_en }));
  const st = useShortTexts(glosses);
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
            <View style={{ gap: space[3] }}>
              <AutoTranslateNote tr={st.note} testID="lingua-tr" />
              <Cards>
                {shown.map((w, i) => (
                  <WordCard
                    key={w.strongBase}
                    word={w}
                    books={books}
                    gloss={st.view(glosses[i])}
                    onOpen={() => useStudy.getState().pushPanel({ kind: 'word', tokenCiteId: w.token.cite_id })}
                    onAsk={() => {
                      const ask = useStudy.getState();
                      ask.attach({ id: w.token.cite_id, kind: 'token', label: bareWord(w.token.surface), citeIds: [w.token.cite_id, ...(w.lexicon ? [w.lexicon.cite_id] : [])] });
                      ask.openChat();
                    }}
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
