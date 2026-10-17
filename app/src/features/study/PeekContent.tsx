// Prévia ("espiar") da folha, sem IA: vizinhos e perícope (escopo) e a fila de fatos da seleção. Os fatos e o
// escopo são calculados em peek-model.ts; aqui só se desenha e se liga aos botões.
import { useMemo } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { Fact, LinkButton, Pill, Txt, gutter, radius, useTheme } from '@/design';
import { chv, refShort } from '@/features/common/format';
import { splitVid, type Vid } from '@sensus/core';
import { useStudy } from '@/state/study';
import { STUDY } from './strings';
import { peekFacts, peekScope } from './peek-model';
import { useStudyData } from './useStudyData';

function FadeEdge({ color, width }: { color: string; width: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <SvgGradient id="sensus-fact-fade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </SvgGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sensus-fact-fade)" />
      </Svg>
    </View>
  );
}

export function PeekContent({ onLayout }: { onLayout: (e: LayoutChangeEvent) => void }) {
  const { c } = useTheme();
  const { range, books, panel, unit, edges, error, reload } = useStudyData();
  const setSelection = useStudy((s) => s.setSelection);
  const goToLens = useStudy((s) => s.goToLens);
  const showToast = useStudy((s) => s.showToast);

  const prev = edges?.prev ?? null;
  const next = edges?.next ?? null;
  // A perícope pode começar na introdução do livro (x:0, sem versículos): exibe e seleciona a partir do 1:1.
  const { unitStart, whole } = peekScope(range, unit);
  // "4:22" no mesmo livro; "Fp 4:23" quando o vizinho está em outro livro.
  const neighborLabel = (v: Vid, own: Vid) => (splitVid(v).book === splitVid(own).book ? chv(v) : refShort(v, v, books, true));

  const facts = useMemo(() => (panel ? peekFacts(panel) : null), [panel]);

  return (
    <View onLayout={onLayout}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: gutter.sheet, paddingBottom: 10 }}>
        {prev !== null && <Pill testID="scope-prev" label={`+ ${neighborLabel(prev, range.start)}`} onPress={() => setSelection(prev, range.end, range.start)} />}
        {unit && unitStart !== null && !whole ? (
          <Pill
            testID="scope-unit"
            variant="suggest"
            label={STUDY.pericope(refShort(unitStart, unit.end, books))}
            onPress={() => {
              setSelection(unitStart, unit.end);
              showToast({ text: STUDY.pericopeExpanded(refShort(unitStart, unit.end, books, true)) });
            }}
          />
        ) : unit ? (
          <Pill variant="dashed" label={STUDY.pericopeWhole} />
        ) : null}
        {next !== null && <Pill testID="scope-next" label={`+ ${neighborLabel(next, range.end)}`} onPress={() => setSelection(range.start, next, range.start)} />}
      </View>

      {!facts && error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingHorizontal: gutter.sheet, paddingBottom: 12 }}>
          <Txt v="bodySm" color="danger">{STUDY.panelError}</Txt>
          <LinkButton label={STUDY.retry} onPress={reload} testID="panel-retry" />
        </View>
      ) : (
      <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingLeft: gutter.sheet, paddingRight: gutter.sheet, paddingBottom: 10 }} style={{ flexGrow: 0 }}>
        {facts ? (
          <>
            <Fact testID="fact-interpretacao" value={facts.authors} label={STUDY.factComentaristas} onPress={() => goToLens('interpretacao')} />
            {facts.variants && (
              <Fact
                testID="fact-texto"
                value={facts.variants.count}
                label={facts.variants.count === 1 ? STUDY.factVariante(facts.variants.editions) : STUDY.factVariantes(facts.variants.editions)}
                onPress={() => goToLens('texto')}
              />
            )}
            <Fact testID="fact-intertexto" value={facts.xrefs} label={STUDY.factXrefs} onPress={() => goToLens('intertexto')} />
            {facts.word && (
              <Fact
                testID="fact-lingua"
                greek
                value={facts.word.lexicon?.lemma ?? facts.word.token.lemma ?? facts.word.token.surface}
                label={facts.hapax ? STUDY.factHapax(facts.word.testament) : STUDY.factVv(facts.word.count, facts.word.testament)}
                onPress={() => goToLens('lingua')}
              />
            )}
            {/* No Android o paddingRight do conteúdo da rolagem horizontal é ignorado: o espaçador garante o respiro à direita. */}
            <View style={{ width: Math.max(0, gutter.sheet - 6) }} />
          </>
        ) : (
          [0, 1, 2].map((i) => <View key={i} style={{ width: 96, height: 44, borderRadius: radius.lg, backgroundColor: c.surfaceAlt, opacity: 0.6 }} />)
        )}
      </ScrollView>
      {facts ? <FadeEdge color={c.surface} width={36} /> : null}
      </View>
      )}

    </View>
  );
}
