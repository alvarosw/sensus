// Card de palavra-chave (proto: wordCard): lema, transliteração, glosa, contagem no testamento e morfologia.
import { memo } from 'react';
import { View } from 'react-native';
import type { Book } from '@sensus/core';
import { Card, CardTop, fontFamilies, LinkButton, MeterBar, MorphPill, space, Tag, Txt, TypeMark, useTheme } from '@/design';
import { bareWord, refShort } from '@/features/common/format';
import { morphChipsOf } from '@/features/common/morph-pt';
import { STUDY } from '../strings';
import type { KeyWord } from '../format';

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
  const { st } = useTheme();
  const t = word.token;
  const lemma = word.lexicon?.lemma ?? t.lemma ?? bareWord(t.surface);
  const translit = word.lexicon?.translit ?? t.translit;
  const gloss = word.lexicon?.gloss ?? t.gloss_en;
  const n = word.count;
  const value = Math.min(1, Math.max(0.06, Math.log(n + 1) / Math.log(120)));
  const morph = morphChipsOf(t.morph_desc, word.testament);
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
            {STUDY.factVv(n, word.testament)}
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
