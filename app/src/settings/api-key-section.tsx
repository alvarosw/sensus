// Chave de API (avançado, recolhido): provedores com chave, URL base, chave mascarada, modelo, teste de conexão.
// Os modelos listados passam pelo filtro de chat do núcleo (só os que conversam em texto; o resto fica oculto).
// Salvar verifica o modelo antes (1 token, ver verify-save.ts): se falhar, nada é salvo; se demorar, avisa e
// ainda salva quando responder. Trocar e Remover ficam numa linha abaixo da caixa da chave; Remover pede confirmação.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { orderModelListings, type ModelListing } from '@sensus/core';
import { Card, fontFamilies, Icon, LinkButton, ListGroup, Pill, RadioOption, radius, Txt, useTheme } from '@/design';
import { FormButton } from '@/features/common/Buttons';
import { checkProviderModel, listProviderModels } from '@/ai/client';
import { LLMError, type ProviderConfig } from '@sensus/core';
import { DEMO_PROVIDER_CONFIG } from '@/ai/demo-provider';
import { formConfig, initialFormSettings } from './resolve';
import { APP_PRESET_IDS, APP_PRESETS, DEMO_PRESET_ID, isAppPresetId, presetNeedsKey, type AppPresetId } from './presets';
import { useSettings } from './settings-context';
import type { StoredProviderSettings } from './provider-store';
import { keyLabelOf } from './use-ai-snapshot';
import { SETTINGS_COPY as COPY } from './strings';
import {
  canReusePass,
  failureOf,
  isSaveBusy,
  isVerifying,
  keyProbeOf,
  VERIFY_COPY,
  VERIFY_IDLE,
  verifyReducer,
  verifySignature,
  type KeyProbe,
  type VerifyEvent,
  type VerifyPurpose,
  type VerifyState,
} from './verify-save';
import { extraBodyFor, recommendedFor, type RecommendedModel } from './recommended';
import { RecommendedGroup, VerifyPanel } from './model-guidance';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

/** Limite de chips de modelo de chat na tela (listas grandes, como a do OpenRouter, são cortadas). */
const MAX_MODEL_CHIPS = 60;
/** Intervalo em que a verificação recalcula o aviso de lentidão e o tempo esgotado. */
const VERIFY_TICK_MS = 250;
/** Tempo máximo da listagem de modelos usada para saber se a chave é aceita (ver probeKey). */
const KEY_PROBE_TIMEOUT_MS = 10_000;

/**
 * Lista os modelos com a mesma chave, para separar problema de chave de problema de modelo. Sem resposta
 * conclusiva (rede, tempo esgotado, endpoint sem listagem), devolve 'unknown'.
 */
async function probeKey(config: ProviderConfig): Promise<KeyProbe> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LLMError('Tempo esgotado na listagem.', 'timeout')), KEY_PROBE_TIMEOUT_MS);
  });
  try {
    await Promise.race([listProviderModels(config), timeout]);
    return keyProbeOf({ ok: true });
  } catch (error) {
    return keyProbeOf({ ok: false, error });
  } finally {
    clearTimeout(timer);
  }
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/v1\/?$/, '');
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt v="eyebrow" color="muted">{label}</Txt>
      {children}
    </View>
  );
}

export function ApiKeySection() {
  const { c } = useTheme();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StoredProviderSettings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keyEditing, setKeyEditing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<ModelListing[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  /** Resultado por id de modelo (✓ / ✗ nas opções): true = respondeu; false = falhou. */
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Verificação do modelo: o estado vive no reducer (verify-save.ts). O espelho em ref é atualizado na hora,
  // para que a continuação de uma chamada só grave se a tentativa ainda estiver válida.
  const [verify, setVerify] = useState<VerifyState>(VERIFY_IDLE);
  const verifyRef = useRef<VerifyState>(VERIFY_IDLE);
  const attemptIdRef = useRef(0);
  const attemptModelRef = useRef('');
  /** Último sucesso de verificação (assinatura e horário): Salvar logo depois não verifica de novo. */
  const passRef = useRef<{ signature: string; at: number } | null>(null);

  const send = (event: VerifyEvent) => {
    verifyRef.current = verifyReducer(verifyRef.current, event);
    setVerify(verifyRef.current);
  };
  /** A tentativa `id` ainda está nesta fase (não foi cancelada, trocada nem expirou). */
  const isLive = (id: number, phase: VerifyState['phase']) => {
    const s = verifyRef.current;
    return s.phase === phase && s.phase !== 'idle' && s.id === id;
  };

  // Enquanto verifica: recalcula o aviso de lentidão e o tempo esgotado.
  const verifyId = verify.phase === 'verifying' ? verify.id : 0;
  useEffect(() => {
    if (verifyId === 0) return;
    const timer = setInterval(() => send({ type: 'tick', at: Date.now() }), VERIFY_TICK_MS);
    return () => clearInterval(timer);
  }, [verifyId]);

  // Falha (inclusive tempo esgotado) marca o modelo com ✗.
  useEffect(() => {
    if (verify.phase === 'failed' && attemptModelRef.current) {
      const model = attemptModelRef.current;
      setVerdicts((v) => ({ ...v, [model]: false }));
    }
  }, [verify]);

  useEffect(() => {
    if (settings.loaded && form === null) setForm(initialFormSettings(settings.stored, settings.devProvider));
  }, [settings.loaded, settings.stored, settings.devProvider, form]);

  if (!settings.loaded || form === null) return null;

  const presetId: AppPresetId | null = isAppPresetId(form.presetId) ? form.presetId : null;
  const isDemo = presetId === DEMO_PRESET_ID;
  const needsKey = presetId ? presetNeedsKey(presetId) : true;
  const hasKey = settings.savedApiKey !== null;
  const update = (patch: Partial<StoredProviderSettings>) => setForm({ ...form, ...patch });
  const recommended = presetId ? recommendedFor(presetId) : [];

  const selectPreset = (id: AppPresetId) => {
    const preset = APP_PRESETS[id];
    setModels([]);
    setShowHidden(false);
    setVerdicts({});
    setConfirmRemove(false);
    setNotice(null);
    setKeyEditing(false);
    setApiKeyInput('');
    send({ type: 'reset' });
    setForm({ presetId: id, baseUrl: preset.baseUrl, model: preset.defaultModel });
  };

  // Chave do .env de desenvolvimento (opt-in) conta como chave em uso, igual ao "Em uso agora".
  const summary = isDemo
    ? COPY.keyDemo
    : hasKey
      ? `${keyLabelOf(settings)} · ${COPY.keySaved}`
      : settings.devProvider
        ? `${keyLabelOf(settings)} · ${COPY.keyDev}`
        : COPY.keyNone;

  /** Chave da verificação e da gravação. Gravar usa só a chave digitada ou a salva (nunca a do .env). */
  const keysFor = (purpose: VerifyPurpose): { key: string; newKey?: string } => {
    const typed = apiKeyInput.trim();
    if (purpose === 'save') return { key: typed || settings.savedApiKey || '', newKey: typed || undefined };
    return { key: typed || settings.savedApiKey || settings.devProvider?.apiKey || '' };
  };

  /** Grava a conexão verificada. Só na tentativa `id` ainda válida (passou e não foi trocada). */
  const commitSave = async (
    id: number,
    draft: { presetId: AppPresetId; baseUrl: string; model: string; extraBody?: Record<string, unknown> },
    newKey: string | undefined,
  ) => {
    try {
      await settings.save({ presetId: draft.presetId, baseUrl: draft.baseUrl, model: draft.model, extraBody: draft.extraBody }, newKey);
      setApiKeyInput('');
      setKeyEditing(false);
      if (isLive(id, 'passed')) send({ type: 'saved', id });
    } catch (e) {
      if (isLive(id, 'passed')) {
        send({ type: 'failed', id, at: Date.now(), failure: { reason: 'save', message: COPY.saveError(messageOf(e)) } });
      }
    }
  };

  /**
   * Verifica o modelo do rascunho e, se pedido com `save`, grava quando responder. Falha ou troca de
   * tentativa: nada é gravado. Um sucesso com a mesma chave, modelo e corpo extra nos últimos 5 min não
   * verifica de novo. Em 401/403/404 separa chave de modelo (probeKey) antes de escolher a frase.
   */
  const startVerification = async (purpose: VerifyPurpose, draft: StoredProviderSettings, key: string, newKey?: string) => {
    if (!presetId || presetId === DEMO_PRESET_ID) return;
    const id = ++attemptIdRef.current;
    const model = draft.model.trim();
    const baseUrl = draft.baseUrl.trim();
    const extraBody = draft.extraBody;
    const signature = verifySignature({ presetId, baseUrl, model, extraBody }, key);
    attemptModelRef.current = model;
    setNotice(null);
    const startedAt = Date.now();
    send({ type: 'start', id, purpose, at: startedAt });
    const draftSave = { presetId, baseUrl, model, extraBody };

    if (canReusePass(passRef.current, signature, startedAt)) {
      send({ type: 'passed', id, at: startedAt });
      setVerdicts((v) => ({ ...v, [model]: true }));
      if (purpose === 'save') await commitSave(id, draftSave, newKey);
      return;
    }

    const config = formConfig(presetId, baseUrl, model, key, extraBody);
    try {
      await checkProviderModel(config);
    } catch (e) {
      if (!isLive(id, 'verifying')) return;
      const keyFault = e instanceof LLMError && (e.code === 'auth' || e.code === 'not_found');
      const probe = keyFault ? await probeKey(config) : 'unknown';
      if (!isLive(id, 'verifying')) return;
      send({ type: 'failed', id, at: Date.now(), failure: failureOf(e, model, probe) });
      setVerdicts((v) => ({ ...v, [model]: false }));
      return;
    }
    if (!isLive(id, 'verifying')) return;
    send({ type: 'passed', id, at: Date.now() });
    passRef.current = { signature, at: Date.now() };
    setVerdicts((v) => ({ ...v, [model]: true }));
    if (purpose === 'save') await commitSave(id, draftSave, newKey);
  };

  /** Cancelar: a resposta que chegar depois é ignorada (a tentativa já não é a viva). */
  const onCancel = () => send({ type: 'cancel' });

  /** Escolhe o modelo (botão, opção recomendada ou digitação). Com verificação em curso, refaz a verificação. */
  const chooseModel = (model: string, extraBody?: Record<string, unknown>) => {
    const draft: StoredProviderSettings = { ...form, model, extraBody };
    setForm(draft);
    const current = verifyRef.current;
    if (current.phase === 'verifying') {
      const { key, newKey } = keysFor(current.purpose);
      void startVerification(current.purpose, draft, key, newKey);
    } else {
      send({ type: 'reset' });
    }
  };

  const onSave = async () => {
    if (!presetId || isSaveBusy(verify)) return;
    const newKey = apiKeyInput.trim();
    const key = newKey || settings.savedApiKey || '';
    if (needsKey && !key) return setNotice({ tone: 'error', text: COPY.needKey });
    if (!form.baseUrl.trim()) return setNotice({ tone: 'error', text: COPY.needBaseUrl });
    if (!form.model.trim()) return setNotice({ tone: 'error', text: COPY.needModel });
    if (isDemo) {
      // Demonstração: offline, nada a verificar.
      try {
        await settings.save({ presetId, baseUrl: form.baseUrl.trim(), model: form.model.trim() }, undefined);
        setNotice({ tone: 'ok', text: COPY.saved });
      } catch (e) {
        setNotice({ tone: 'error', text: COPY.saveError(messageOf(e)) });
      }
      return;
    }
    await startVerification('save', form, key, newKey || undefined);
  };

  const onTest = async () => {
    if (!presetId) return;
    const key = apiKeyInput.trim() || settings.savedApiKey || settings.devProvider?.apiKey || '';
    if (needsKey && !key) {
      setModels([]);
      return setNotice({ tone: 'error', text: COPY.needKeyToTest });
    }
    if (!form.baseUrl.trim()) return setNotice({ tone: 'error', text: COPY.needBaseUrl });
    const config = isDemo
      ? { ...DEMO_PROVIDER_CONFIG }
      : formConfig(presetId as Exclude<AppPresetId, 'demo'>, form.baseUrl, form.model, key, form.extraBody);
    setTesting(true);
    setNotice(null);
    try {
      const found = await listProviderModels(config);
      setModels(found);
      setNotice({ tone: 'ok', text: COPY.testOk(found.filter((m) => m.usable).length) });
    } catch (e) {
      setModels([]);
      setNotice({ tone: 'error', text: COPY.testFail(messageOf(e)) });
    } finally {
      setTesting(false);
    }
  };

  const onVerify = () => {
    if (!presetId || isDemo || isVerifying(verify)) return;
    const { key } = keysFor('check');
    if (needsKey && !key) return setNotice({ tone: 'error', text: COPY.needKeyToTest });
    if (!form.baseUrl.trim()) return setNotice({ tone: 'error', text: COPY.needBaseUrl });
    if (!form.model.trim()) return setNotice({ tone: 'error', text: COPY.needModel });
    void startVerification('check', form, key);
  };

  const onRemoveKey = async () => {
    await settings.removeApiKey();
    setKeyEditing(false);
    setConfirmRemove(false);
    setNotice({ tone: 'ok', text: COPY.keyRemoved });
  };

  const inputStyle = {
    height: 42,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    color: c.text,
    backgroundColor: c.surface,
    fontFamily: fontFamilies.ui,
    fontSize: 14,
  } as const;
  const monoInput = { ...inputStyle, fontFamily: fontFamilies.mono, fontSize: 12.5 } as const;

  const header = (
    <Pressable
      testID="api-key-disclosure"
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((o) => !o)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="lensTitle" style={{ fontSize: 16, lineHeight: 21 }}>{COPY.keyTitle}</Txt>
        <Txt v="meta" color="muted" style={{ fontFamily: fontFamilies.ui }}>{summary}</Txt>
      </View>
      <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
        <Icon name="chevronDown" size={16} color={c.muted} />
      </View>
    </Pressable>
  );

  if (!open) return <Card testID="api-key-card">{header}</Card>;

  const providerFields = (
    <ListGroup testID="api-key-presets">
      {APP_PRESET_IDS.map((id, i) => (
        <RadioOption
          key={id}
          testID={`preset-${id}`}
          first={i === 0}
          selected={id === presetId}
          title={APP_PRESETS[id].label}
          help={id === DEMO_PRESET_ID ? 'offline, sem chave nem rede' : id === 'custom' ? 'compatível com OpenAI' : hostOf(APP_PRESETS[id].baseUrl)}
          mono={id !== DEMO_PRESET_ID}
          onPress={() => selectPreset(id)}
        />
      ))}
    </ListGroup>
  );

  let body: React.ReactNode;
  if (isDemo) {
    body = <Txt v="bodySm" color="muted">{COPY.demoHint}</Txt>;
  } else {
    const actionRow = { flexDirection: 'row' as const, alignItems: 'center' as const, flexWrap: 'wrap' as const, gap: 18 };
    const keyField =
      hasKey && !keyEditing ? (
        <View style={{ gap: 4 }}>
          <View testID="api-key-masked-box" style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, paddingHorizontal: 12, minHeight: 42, justifyContent: 'center', backgroundColor: c.surface }}>
            <Txt v="bodySm" color="muted" testID="api-key-masked">{'•••••••••••• · ' + COPY.apiKeyMasked}</Txt>
          </View>
          {confirmRemove ? (
            <View testID="api-key-remove-confirm" style={{ gap: 6, paddingTop: 4 }}>
              <Txt v="bodySm">{COPY.removeConfirm}</Txt>
              <View style={actionRow}>
                <LinkButton testID="api-key-remove-cancel" label={COPY.cancel} onPress={() => setConfirmRemove(false)} />
                <LinkButton testID="settings-remove-key" tone="danger" label={COPY.remove} onPress={onRemoveKey} />
              </View>
            </View>
          ) : (
            <View style={[actionRow, { paddingTop: 4 }]}>
              <LinkButton testID="api-key-change" label={COPY.change} onPress={() => setKeyEditing(true)} />
              <LinkButton testID="api-key-remove" tone="danger" label={COPY.remove} onPress={() => setConfirmRemove(true)} />
            </View>
          )}
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <TextInput
            testID="settings-api-key"
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            placeholder={COPY.apiKeyPlaceholder}
            placeholderTextColor={c.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            accessibilityLabel={COPY.apiKey}
            style={monoInput}
          />
          {hasKey ? (
            <View style={[actionRow, { paddingTop: 4 }]}>
              <LinkButton testID="api-key-edit-cancel" label={COPY.cancel} onPress={() => { setKeyEditing(false); setApiKeyInput(''); }} />
            </View>
          ) : null}
        </View>
      );

    // Modelos de chat primeiro (o recomendado do preset no topo); ocultos só com "Mostrar todos".
    // Os recomendados aparecem no grupo próprio, então não se repetem na lista.
    const recIds = new Set(recommended.map((m) => m.id));
    const ordered = orderModelListings(models, presetId ? APP_PRESETS[presetId].defaultModel : undefined).filter(
      (m) => !recIds.has(m.id),
    );
    const usable = ordered.filter((m) => m.usable);
    const hidden = ordered.filter((m) => !m.usable);
    const shownChats = usable.slice(0, MAX_MODEL_CHIPS);
    const chipList = showHidden ? [...shownChats, ...hidden] : shownChats;
    const modelChips = models.length > 0 ? (
      <View style={{ gap: 8 }}>
        <Txt v="eyebrow" color="muted">{COPY.pickModel}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {chipList.map((m) => {
            const verdict = verdicts[m.id];
            const mark = verdict === undefined ? '' : verdict ? '✓ ' : '✗ ';
            return (
              <Pill
                key={m.id}
                testID={`model-chip-${m.id}`}
                label={mark + m.id}
                variant={m.id === form.model ? 'suggest' : m.usable ? 'default' : 'dashed'}
                onPress={() => chooseModel(m.id, extraBodyFor(presetId ?? '', m.id))}
              />
            );
          })}
        </View>
        {hidden.length > 0 ? (
          <View style={{ gap: 6 }}>
            <LinkButton
              testID="settings-models-toggle"
              label={showHidden ? COPY.hideHiddenModels : COPY.showAllModels(hidden.length)}
              onPress={() => setShowHidden((v) => !v)}
            />
            {showHidden ? <Txt v="meta" color="muted">{COPY.hiddenHint}</Txt> : null}
          </View>
        ) : null}
        {usable.length > shownChats.length ? (
          <Txt v="meta" color="muted">{COPY.moreModels(shownChats.length, usable.length)}</Txt>
        ) : null}
      </View>
    ) : null;

    const verifyingNow = isVerifying(verify);
    const saveBusy = isSaveBusy(verify);

    body = (
      <View style={{ gap: 12 }}>
        <Field label={COPY.baseUrl}>
          <TextInput
            testID="settings-base-url"
            value={form.baseUrl}
            onChangeText={(baseUrl) => update({ baseUrl })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={presetId === 'custom'}
            accessibilityLabel={COPY.baseUrl}
            style={[monoInput, presetId !== 'custom' && { opacity: 0.6 }]}
          />
        </Field>
        <Field label={COPY.apiKey}>
          {keyField}
          <Txt v="meta" color="muted">{COPY.keyHint}</Txt>
        </Field>
        <Field label={COPY.modelField}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch' }}>
            <TextInput
              testID="settings-model"
              value={form.model}
              onChangeText={(model) => {
                update({ model, extraBody: presetId ? extraBodyFor(presetId, model.trim()) : undefined });
                if (!verifyingNow) send({ type: 'reset' });
              }}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={COPY.modelField}
              style={[monoInput, { flex: 1, minWidth: 0 }]}
            />
            <FormButton
              testID="settings-test"
              variant="secondary"
              label={testing ? COPY.testing : COPY.test}
              disabled={testing}
              onPress={onTest}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <LinkButton testID="settings-verify" label={verifyingNow ? COPY.verifying : COPY.verify} onPress={onVerify} />
          </View>
        </Field>
        {recommended.length > 0 ? (
          <RecommendedGroup
            models={recommended}
            selectedId={form.model.trim()}
            onPick={(m) => chooseModel(m.id, m.extraBody)}
          />
        ) : null}
        {modelChips}
        {notice ? (
          <Txt v="bodySm" tint={notice.tone === 'ok' ? c.srcText : c.danger} testID="settings-notice">{notice.text}</Txt>
        ) : null}
        {/* O resultado da verificação (e Cancelar) fica logo acima de Salvar: é onde o usuário olha. */}
        <VerifyPanel
          state={verify}
          recommended={recommended}
          onCancel={onCancel}
          onPick={(m: RecommendedModel) => chooseModel(m.id, m.extraBody)}
        />
        <FormButton
          testID="settings-save"
          label={verify.phase === 'verifying' ? VERIFY_COPY.verifying : verify.phase === 'passed' && saveBusy ? COPY.saving : COPY.save}
          disabled={saveBusy}
          onPress={onSave}
        />
      </View>
    );
  }

  return (
    <Card testID="api-key-card" style={{ gap: 14 }}>
      {header}
      {settings.mode === 'chatgpt' ? <Txt v="meta" color="muted">{COPY.chatgptModeNote}</Txt> : null}
      <Field label={COPY.provider}>{providerFields}</Field>
      {body}
    </Card>
  );
}
