// O fio do trecho (Visão geral): a abertura da IA e, abaixo, um passo por lente na ordem da narrativa.
// Cada passo mostra a evidência do banco (aparece na hora) e, embaixo, o texto da IA daquela seção.
import { View } from 'react-native';
import { router } from 'expo-router';
import { ActButton, Card, Empty, Greek, LinkButton, Tag, Txt, space, radius, useTheme } from '@/design';
import { RichBlocks } from '../rich/RichBlocks';
import { LENS_LABELS, useStudy } from '@/state/study';
import { SkeletonLines, ThinkingLine } from './LensShell';
import { STUDY } from './strings';
import { type ThreadEvidence, type ThreadStep } from './thread';
import { useStudyAi, useStudyData } from './useStudyData';
import { refShort } from './format';

export function Thread({ steps }: { steps: ThreadStep[] }) {
  const ai = useStudyAi();
  return (
    <View style={{ gap: space[6] }} testID="thread">
      {ai.status === 'noprovider' ? <NoProviderCard /> : <Overview />}
      {steps.length > 0 && (
        <View testID="thread-steps">
          {steps.map((s, i) => (
            <Step key={s.lens} step={s} index={i} last={i === steps.length - 1} />
          ))}
        </View>
      )}
    </View>
  );
}

// ---- abertura da IA ----------------------------------------------------------------------------------

function NoProviderCard() {
  return (
    <Card testID="ai-noprovider" style={{ gap: space[4] }}>
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

function Overview() {
  const ai = useStudyAi();
  if (ai.status === 'error') {
    return (
      <View style={{ gap: space[3] }}>
        <Txt v="bodySm" color="danger" testID="ai-error">{STUDY.summaryError(ai.error ?? '')}</Txt>
        <View style={{ flexDirection: 'row' }}>
          <LinkButton label={STUDY.retry} onPress={ai.retry} testID="ai-retry" />
        </View>
      </View>
    );
  }
  const blocks = ai.summary?.overview;
  const hasBlocks = !!blocks && blocks.length > 0;
  return (
    <View style={{ gap: space[4] }} testID="ai-visao">
      <ScopeTag />
      {hasBlocks ? (
        <RichBlocks
          blocks={blocks}
          streaming={ai.writingLens === 'visao'}
          claimKeyPrefix="visao"
          onDeepen={(info) => ai.deepen('visao', { claim: info.text, claimKey: info.claimKey })}
        />
      ) : ai.status === 'done' ? (
        <Empty text={STUDY.noSummary} />
      ) : ai.thinking ? (
        <ThinkingLine />
      ) : (
        <SkeletonLines lines={3} />
      )}
    </View>
  );
}

// ---- passos ------------------------------------------------------------------------------------------

function Step({ step, index, last }: { step: ThreadStep; index: number; last: boolean }) {
  const { c } = useTheme();
  const ai = useStudyAi();
  const blocks = ai.summary?.sections[step.lens];
  const hasText = !!blocks && blocks.length > 0;
  // O resumo chega na ordem do fio: a seção com texto que está sendo escrita é a última recebida.
  const writing = ai.writingLens === step.lens;
  const done = hasText && !writing;
  const showText = ai.status !== 'noprovider' && ai.status !== 'error';

  return (
    <View style={{ flexDirection: 'row', gap: space[4] }} testID={`thread-step-${step.lens}`}>
      <View style={{ width: 22, alignItems: 'center' }}>
        {!last && <View style={{ position: 'absolute', left: 10, top: 24, bottom: 0, width: 2, backgroundColor: c.border }} />}
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: c.accent,
            backgroundColor: done ? c.accent : c.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt v="meta" tint={done ? c.accentText : c.accent} bold style={{ fontSize: 10.5 }}>{`${index + 1}`}</Txt>
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: space[4], paddingBottom: last ? 0 : space[6] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[3], flexWrap: 'wrap' }}>
          <Txt v="bodySm" bold>{step.title}</Txt>
          <LinkButton
            label={`${LENS_LABELS[step.lens]} →`}
            onPress={() => useStudy.getState().goToLens(step.lens)}
            testID={`thread-link-${step.lens}`}
          />
        </View>

        {step.evidence?.kind === 'pending' ? (
          <View testID="thread-ev-pending">
            <SkeletonLines lines={1} />
          </View>
        ) : (
          step.evidence && <Evidence evidence={step.evidence} />
        )}

        {showText &&
          (hasText ? (
            <RichBlocks
              blocks={blocks}
              streaming={writing}
              claimKeyPrefix={`thread-${step.lens}`}
              onDeepen={(info) => ai.deepen(step.lens, { claim: info.text, claimKey: info.claimKey })}
            />
          ) : ai.status === 'done' ? (
            <Empty text={STUDY.noSummary} />
          ) : (
            <SkeletonLines lines={2} />
          ))}
      </View>
    </View>
  );
}

/** Evidência determinística do passo: a mesma linha de dados que a lente mostra, em miniatura. */
function Evidence({ evidence }: { evidence: ThreadEvidence }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 8, gap: space[3] }} testID="thread-ev">
      {evidence.kind === 'verse' && (
        <Txt v="excerpt" style={{ fontSize: 13.5, lineHeight: 20 }}>
          {`“${evidence.text}” `}
          <Txt v="meta" color="muted">{evidence.ref}</Txt>
        </Txt>
      )}

      {evidence.kind === 'word' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[3] }}>
          <Greek base="lemma" onPress={() => useStudy.getState().pushPanel({ kind: 'word', tokenCiteId: evidence.tokenCiteId })}>
            {evidence.lemma}
          </Greek>
          {evidence.gloss && <Txt v="meta" color="muted">{`“${evidence.gloss}”`}</Txt>}
          {evidence.note === STUDY.hapax ? <Tag label={STUDY.hapax} tone="tint" /> : evidence.note && <Txt v="meta" color="muted">{evidence.note}</Txt>}
          {evidence.mentions ? <Txt v="meta" color="muted">{STUDY.commentMentions(evidence.mentions)}</Txt> : null}
        </View>
      )}

      {evidence.kind === 'variants' && (
        <View style={{ gap: space[2] }}>
          <Txt v="meta" color="muted">{`${evidence.ref} · ${STUDY.variantType}`}</Txt>
          {evidence.readings.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[3] }}>
              {r.text === STUDY.omits ? <Txt v="meta" color="muted">{r.text}</Txt> : <Greek base="bodySm">{r.text}</Greek>}
              {r.editions.map((ed) => (
                <Tag key={ed} label={ed} tone={ed === 'TR' ? 'tint' : 'neutral'} />
              ))}
            </View>
          ))}
        </View>
      )}

      {evidence.kind === 'xref' && (
        <View style={{ gap: space[2] }}>
          <Txt v="meta" color="muted">{evidence.ref}</Txt>
          <Txt v="excerpt" numberOfLines={3} style={{ fontSize: 13.5, lineHeight: 20 }}>{`“${evidence.text}”`}</Txt>
        </View>
      )}

      {evidence.kind === 'names' && <Txt v="bodySm">{evidence.names.join(' · ')}</Txt>}

      {evidence.kind === 'commentators' && (
        <Txt v="bodySm">
          {evidence.names.join(' · ') + (evidence.more > 0 ? ` · ${STUDY.andMore(evidence.more)}` : '')}
        </Txt>
      )}
    </View>
  );
}
