// Orientação sobre o modelo na tela Assistente de IA: grupo "Recomendados" (seletor) e painel da verificação
// (verificando, lento, falhou, funciona). Copy e regras da verificação em verify-save.ts.
import { ActivityIndicator, Pressable, View } from 'react-native';
import { fontFamilies, LinkButton, Pill, radius, Tag, Txt, useTheme } from '@/design';
import { offersQuickPicks, suggestionsFor, VERIFY_COPY, type VerifyState } from './verify-save';
import { TIER_LABEL, type RecommendedModel } from './recommended';

/** Grupo "Recomendados": nome, etiqueta de tipo e nota. Escolher um aplica o modelo e o corpo extra dele. */
export function RecommendedGroup({
  models,
  selectedId,
  onPick,
}: {
  models: readonly RecommendedModel[];
  selectedId: string;
  onPick: (model: RecommendedModel) => void;
}) {
  const { c } = useTheme();
  if (models.length === 0) return null;
  return (
    <View testID="model-recommended" style={{ gap: 8 }}>
      <Txt v="eyebrow" color="muted">Recomendados</Txt>
      <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.card, overflow: 'hidden' }}>
        {models.map((m, i) => {
          const selected = m.id === selectedId;
          return (
            <Pressable
              key={m.id}
              testID={`recommended-${m.id}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${m.label}. ${TIER_LABEL[m.tier]}. ${m.note}`}
              onPress={() => onPick(m)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
                backgroundColor: selected ? c.tint + '55' : 'transparent',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <Txt v="bodySm" bold style={{ fontFamily: fontFamilies.uiSemibold }}>{m.label}</Txt>
                  <Tag label={TIER_LABEL[m.tier]} tone={m.tier === 'equilibrado' ? 'neutral' : 'tint'} />
                </View>
                <Txt v="meta" color="muted" style={{ fontFamily: fontFamilies.ui }}>{m.note}</Txt>
                <Txt v="meta" color="muted" style={{ fontFamily: fontFamilies.mono, fontSize: 11 }}>{m.id}</Txt>
              </View>
              {selected ? <Txt v="meta" color="accent" bold>✓</Txt> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Opções rápidas: os modelos recomendados como botões, para trocar de modelo sem digitar. */
function QuickPicks({ models, onPick }: { models: readonly RecommendedModel[]; onPick: (model: RecommendedModel) => void }) {
  if (models.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Txt v="meta" color="muted">Modelos recomendados:</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {models.map((m) => (
          <Pill key={m.id} testID={`quick-pick-${m.id}`} label={m.label} variant="suggest" onPress={() => onPick(m)} />
        ))}
      </View>
    </View>
  );
}

/**
 * Painel da verificação, logo abaixo do campo Modelo. Some quando idle. Verificando: progresso e Cancelar;
 * lento: aviso âmbar com opções rápidas; falhou: motivo, sugestões e opções rápidas; funcionou: confirmação.
 */
export function VerifyPanel({
  state,
  recommended,
  onCancel,
  onPick,
}: {
  state: VerifyState;
  recommended: readonly RecommendedModel[];
  onCancel: () => void;
  onPick: (model: RecommendedModel) => void;
}) {
  const { c } = useTheme();
  if (state.phase === 'idle') return null;
  const quick = offersQuickPicks(state) ? <QuickPicks models={recommended} onPick={onPick} /> : null;
  const warnBox = (children: React.ReactNode) => (
    <View testID="verify-slow" style={{ backgroundColor: c.warn, borderRadius: radius.lg, padding: 12, gap: 10 }}>
      {children}
    </View>
  );

  if (state.phase === 'verifying') {
    const row = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <ActivityIndicator size="small" color={c.muted} />
        <Txt v="bodySm" color="muted" testID="verify-progress">{VERIFY_COPY.verifying}</Txt>
        <LinkButton testID="verify-cancel" label={VERIFY_COPY.cancel} onPress={onCancel} />
      </View>
    );
    if (!state.slow) return <View testID="verify-panel" style={{ gap: 6 }}>{row}</View>;
    return (
      <View testID="verify-panel" style={{ gap: 8 }}>
        {row}
        {warnBox(
          <>
            <Txt v="bodySm" tint={c.warnText} testID="verify-slow-text">{VERIFY_COPY.slowPending}</Txt>
            {quick}
          </>,
        )}
      </View>
    );
  }

  if (state.phase === 'failed') {
    const title = state.purpose === 'save' ? VERIFY_COPY.failedSave : VERIFY_COPY.failedCheck;
    return (
      <View testID="verify-panel" style={{ gap: 8, borderWidth: 1, borderColor: c.danger, borderRadius: radius.lg, padding: 12 }}>
        <Txt v="bodySm" bold tint={c.danger} testID="verify-failed-title">{title}</Txt>
        <Txt v="bodySm" testID="verify-failed-reason">{state.failure.message}</Txt>
        <View style={{ gap: 3 }}>
          {suggestionsFor(state.failure.reason).map((s) => (
            <Txt key={s} v="meta" color="muted">• {s}</Txt>
          ))}
        </View>
        {quick}
      </View>
    );
  }

  if (state.phase === 'passed') {
    if (state.purpose === 'save') {
      return <Txt v="bodySm" tint={c.srcText} testID="verify-result">{VERIFY_COPY.savingVerified}</Txt>;
    }
    if (!state.slow) return <Txt v="bodySm" tint={c.srcText} testID="verify-result">{VERIFY_COPY.okCheck}</Txt>;
    return (
      <View testID="verify-panel">
        {warnBox(
          <>
            <Txt v="bodySm" tint={c.warnText} testID="verify-slow-text">{VERIFY_COPY.slowDone(state.elapsedMs)}</Txt>
            {quick}
          </>,
        )}
      </View>
    );
  }

  // saved
  if (!state.slow) return <Txt v="bodySm" tint={c.srcText} testID="verify-result">{VERIFY_COPY.saved}</Txt>;
  return (
    <View testID="verify-panel">
      {warnBox(
        <>
          <Txt v="bodySm" tint={c.warnText} testID="verify-slow-text">{VERIFY_COPY.savedSlow}</Txt>
          {quick}
        </>,
      )}
    </View>
  );
}
