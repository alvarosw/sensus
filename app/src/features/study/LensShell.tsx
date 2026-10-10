// Casca de uma lente (proto: lensShell): título + contagem, bloco da IA, "DETALHADO", conteúdo das fontes,
// ações (Detalhar / Ver todos) e perguntas sugeridas.
import { memo, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import {
  ActButton,
  Caret,
  Card,
  Empty,
  LinkButton,
  QuestionButton,
  Skeleton,
  Tag,
  Txt,
  space,
  useTheme,
} from '@/design';
import { RichBlocks } from '../rich/RichBlocks';
import { useStudy, type LensKey } from '@/state/study';
import { STUDY } from './strings';
import { refShort } from './format';
import { useStudyAi, useStudyData, type DeepView } from './useStudyData';

export interface LensShellProps {
  lens: LensKey;
  title: string;
  count?: string;
  /** Total de itens de fonte além dos exibidos (botão "Ver todos N"); 0 = sem botão. */
  sourcesN?: number;
  /** Conteúdo determinístico (cards). */
  children?: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
}

export const LensShell = memo(function LensShell({ lens, title, count, sourcesN = 0, children, onLayout }: LensShellProps) {
  const { c } = useTheme();
  const ai = useStudyAi();
  const expanded = useStudy((s) => !!s.expanded[lens]);
  const toggleExpanded = useStudy((s) => s.toggleExpanded);
  const askQuestion = useStudy((s) => s.askQuestion);
  const deep = ai.deepViews(lens);
  const hasMainDeep = deep.some((d) => d.claim === '');
  const questions = ai.questions(lens);

  return (
    <View
      testID={`lens-${lens}`}
      onLayout={onLayout}
      style={{
        paddingTop: space[9],
        paddingHorizontal: 16,
        paddingBottom: space[3],
        gap: space[6],
        borderTopWidth: lens === 'visao' ? 0 : 1,
        borderTopColor: c.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[4] }}>
        <Txt v="lensTitle" accessibilityRole="header">{title}</Txt>
        {count ? <Txt v="meta" color="muted" style={{ fontSize: 11.5 }}>{count}</Txt> : null}
      </View>

      <AiBlock lens={lens} />
      {deep.map((d, i) => (
        <DeepBlock key={d.key} lens={lens} view={d} index={i} />
      ))}

      {children}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        {ai.canDeepen && !hasMainDeep && <ActButton deepen label={STUDY.deepen} onPress={() => ai.deepen(lens)} testID={`deepen-${lens}`} />}
        {sourcesN > 0 && (
          <ActButton
            label={expanded ? STUDY.seeLess : STUDY.seeAll}
            count={expanded ? undefined : sourcesN}
            onPress={() => toggleExpanded(lens)}
            testID={`expand-${lens}`}
          />
        )}
      </View>

      {questions.length > 0 && (
        <View style={{ gap: space[3] }}>
          {questions.map((q, i) => (
            <QuestionButton key={`${i}-${q}`} text={q} onPress={() => askQuestion(q)} testID={`q-${lens}-${i}`} />
          ))}
        </View>
      )}
    </View>
  );
});

// ---- bloco da IA -----------------------------------------------------------------------------------

function SkeletonLines({ lines = 3 }: { lines?: number }) {
  const widths = ['92%', '78%', '40%'] as const;
  return (
    <View style={{ gap: space[4] }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} />
      ))}
    </View>
  );
}

/** Modelo de raciocínio ainda pensando, sem texto: uma linha discreta no lugar do esqueleto. */
function ThinkingLine() {
  return (
    <Txt v="meta" color="muted" italic testID="ai-thinking">
      {STUDY.thinking}
      <Caret />
    </Txt>
  );
}

function NoProviderCard() {
  return (
    <Card testID="ai-noprovider" style={{ gap: space[5] }}>
      <Txt v="bodySm" bold>Resumo por IA</Txt>
      <Txt v="bodySm" color="muted">{STUDY.noProvider}</Txt>
      <View style={{ flexDirection: 'row' }}>
        <ActButton deepen label={STUDY.configure} onPress={() => router.push('/settings')} testID="ai-configure" />
      </View>
    </Card>
  );
}

function ScopeTag() {
  const ai = useStudyAi();
  const { books } = useStudyData();
  if (!ai.unitRange) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' }}>
      <Txt v="meta" color="muted" style={{ fontSize: 11 }}>{STUDY.summaryOfUnit}</Txt>
      <Tag label={refShort(ai.unitRange.start, ai.unitRange.end, books)} />
      <Txt v="meta" color="muted" style={{ fontSize: 11 }}>{STUDY.summaryContains}</Txt>
    </View>
  );
}

function AiBlock({ lens }: { lens: LensKey }) {
  const ai = useStudyAi();
  const deepenClaim = (info: { text: string; claimKey: string }) => ai.deepen(lens, { claim: info.text, claimKey: info.claimKey });

  if (ai.status === 'noprovider') return lens === 'visao' ? <NoProviderCard /> : null;

  if (ai.status === 'error') {
    return lens === 'visao' ? (
      <View style={{ gap: space[3] }}>
        <Txt v="bodySm" color="danger" testID="ai-error">{STUDY.summaryError(ai.error ?? '')}</Txt>
        <View style={{ flexDirection: 'row' }}>
          <LinkButton label={STUDY.retry} onPress={ai.retry} testID="ai-retry" />
        </View>
      </View>
    ) : (
      <Empty text="Resumo indisponível. Veja a Visão geral." />
    );
  }

  const blocks = lens === 'visao' ? ai.summary?.overview : ai.summary?.sections[lens as Exclude<LensKey, 'visao'>];
  const hasBlocks = !!blocks && blocks.length > 0;
  return (
    <View style={{ gap: space[4] }} testID={`ai-${lens}`}>
      {lens === 'visao' && <ScopeTag />}
      {hasBlocks ? (
        <RichBlocks
          blocks={blocks}
          streaming={ai.writingLens === lens}
          claimKeyPrefix={lens}
          onDeepen={deepenClaim}
        />
      ) : ai.status === 'done' ? (
        <Empty text={STUDY.noSummary} />
      ) : ai.thinking ? (
        <ThinkingLine />
      ) : (
        <SkeletonLines lines={lens === 'visao' ? 3 : 2} />
      )}
    </View>
  );
}

function DeepBlock({ lens, view, index }: { lens: LensKey; view: DeepView; index: number }) {
  const { c } = useTheme();
  const ai = useStudyAi();
  const askQuestion = useStudy((s) => s.askQuestion);
  return (
    <View
      testID={`deep-${lens}-${index}`}
      style={{ borderLeftWidth: 2, borderLeftColor: c.accent, paddingLeft: 12, gap: space[4] }}
    >
      <Txt v="eyebrow" color="accent">{STUDY.deepened}</Txt>
      {view.claim ? (
        <Txt v="meta" color="muted" numberOfLines={2}>
          {`Sobre: “${view.claim.length > 120 ? `${view.claim.slice(0, 120).trim()}…` : view.claim}”`}
        </Txt>
      ) : null}
      {view.blocks.length > 0 ? (
        <RichBlocks
          blocks={view.blocks}
          streaming={view.status === 'streaming'}
          claimKeyPrefix={`${lens}-d${index}`}
          onDeepen={(info) => ai.deepen(lens, { claim: info.text, claimKey: info.claimKey })}
        />
      ) : view.status === 'error' ? (
        <Txt v="bodySm" color="danger">{view.error ?? STUDY.summaryError('')}</Txt>
      ) : view.thinking ? (
        <ThinkingLine />
      ) : (
        <SkeletonLines />
      )}
      {view.status === 'error' && view.blocks.length > 0 ? <Txt v="bodySm" color="danger">{view.error}</Txt> : null}
      {view.status === 'done' &&
        view.followUps.slice(0, 3).map((q, i) => (
          <QuestionButton key={`${i}-${q}`} text={q} onPress={() => askQuestion(q)} testID={`q-deep-${lens}-${index}-${i}`} />
        ))}
    </View>
  );
}
