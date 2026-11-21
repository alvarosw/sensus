// Cartão "Curiosidade do trecho" na folha: aparece só com uma curiosidade aprovada (ver useCuriosity.ts). Recolhido por
// padrão: o gancho, "Perguntar sobre isto", "Ver fontes" e "Ver por quê", que mostra as três frases (na época, hoje,
// o que muda) com as citações tocáveis. É filho direto da rolagem da folha (SheetBody), entre o espaçador do trilho e
// a Visão geral; a altura vai para a folha, que a usa para a âncora de rolagem.
import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ActButton, LinkButton, Txt, motion, radius, space, useTheme } from '@/design';
import { RichBlocks } from '@/features/rich';
import { useStudy } from '@/state/study';
import type { Block } from '@sensus/core';
import { useReduceMotion } from '../common/hooks';
import { plainText, shortHook } from './curiosity-model';
import { STUDY } from './strings';
import { useStudyCuriosity } from './study-context';
import type { CuriosityView } from './study-state';

export function CuriosityCard({ onHeight }: { onHeight: (h: number) => void }) {
  const view = useStudyCuriosity();
  // Chave por unidade: o "Ver por quê" aberto de uma curiosidade não passa para a outra.
  if (!view) return null;
  return <CuriosityBody key={view.key} view={view} onHeight={onHeight} />;
}

function CuriosityBody({ view, onHeight }: { view: CuriosityView; onHeight: (h: number) => void }) {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const attach = useStudy((s) => s.attach);
  const openChat = useStudy((s) => s.openChat);
  const openPopover = useStudy((s) => s.openPopover);
  const [more, setMore] = useState(false);

  // Entrada suave (opacidade e leve deslocamento); com "reduzir movimento" o cartão aparece pronto.
  const enter = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) enter.value = withTiming(1, { duration: 250, easing: Easing.bezier(...motion.easing) });
  }, [reduce, enter]);
  const entering = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: (1 - enter.value) * 6 }] }));

  // Sai da folha: a altura volta a zero para a rolagem não contar um cartão que não existe mais.
  useEffect(() => () => onHeight(0), [onHeight]);

  const { candidate } = view;
  const askText = `${view.hook}. ${plainText(candidate.change)}`;
  const eyebrow = candidate.kind === 'eco' ? STUDY.curiosity.echo : STUDY.curiosity.term;

  return (
    <Animated.View
      testID="curiosity-card"
      accessibilityLabel={STUDY.curiosity.label}
      onLayout={(e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height)}
      style={[{ paddingHorizontal: 16, paddingTop: space[6], paddingBottom: space[6] }, entering]}
    >
      <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: 12, gap: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent }} />
          <Txt v="eyebrow" color="accent" testID="curiosity-eyebrow">{eyebrow}</Txt>
        </View>

        <Txt v="lensTitle" bold style={{ fontSize: 17, lineHeight: 23 }} testID="curiosity-hook">
          {view.hook}
        </Txt>

        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[4] }}>
          <ActButton
            deepen
            label={STUDY.askAbout}
            testID="curiosity-ask"
            onPress={() => {
              attach({ id: `curiosity:${view.key}`, kind: 'claim', label: `“${shortHook(view.hook)}”`, citeIds: candidate.evidence, text: askText });
              openChat();
            }}
          />
          <LinkButton label={STUDY.curiosity.sources} testID="curiosity-sources" onPress={() => openPopover(candidate.evidence[0]!)} />
          <LinkButton label={more ? STUDY.curiosity.less : STUDY.curiosity.more} testID="curiosity-more" onPress={() => setMore((v) => !v)} />
        </View>

        {more ? (
          <View style={{ gap: space[5] }} testID="curiosity-details">
            <Part label={STUDY.curiosity.then} blocks={view.listener} id="then" />
            {/* "Hoje" descreve a leitura comum, não é afirmação sobre a fonte: texto simples, sem o grifo de "sem citação". */}
            <View style={{ gap: space[2] }}>
              <Txt v="meta" color="muted" bold>{STUDY.curiosity.today}</Txt>
              <Txt v="body">{plainText(view.candidate.today)}</Txt>
            </View>
            <Part label={STUDY.curiosity.change} blocks={view.change} id="change" />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function Part({ label, blocks, id }: { label: string; blocks: Block[]; id: string }) {
  return (
    <View style={{ gap: space[2] }}>
      <Txt v="meta" color="muted" bold>{label}</Txt>
      <RichBlocks blocks={blocks} claimKeyPrefix={`curiosity-${id}`} claimMenu={false} />
    </View>
  );
}
