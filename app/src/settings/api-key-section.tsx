// Chave de API (avançado, recolhido): provedores com chave, URL base, chave mascarada, modelo, teste de conexão.
// Os modelos listados passam pelo filtro de chat do núcleo (só os que conversam em texto; o resto fica oculto).
// Trocar e Remover ficam numa linha abaixo da caixa da chave; Remover pede confirmação.
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { buildProviderConfig, orderModelListings, type ModelListing } from '@sensus/core';
import { Card, fontFamilies, Icon, LinkButton, ListGroup, Pill, RadioOption, radius, Txt, useTheme } from '@/design';
import { FormButton } from '@/features/common/Buttons';
import { checkProviderModel, listProviderModels } from '@/ai/client';
import { DEMO_PROVIDER_CONFIG } from '@/ai/demo-provider';
import { initialFormSettings } from './resolve';
import { APP_PRESET_IDS, APP_PRESETS, DEMO_PRESET_ID, isAppPresetId, presetNeedsKey, type AppPresetId } from './presets';
import { useSettings } from './settings-context';
import type { StoredProviderSettings } from './provider-store';
import { keyLabelOf } from './use-ai-snapshot';
import { SETTINGS_COPY as COPY } from './strings';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

/** Limite de chips de modelo de chat na tela (listas grandes, como a do OpenRouter, são cortadas). */
const MAX_MODEL_CHIPS = 60;

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
  /** Resultado da verificação sob demanda, por id de modelo: true = respondeu; texto = motivo da falha. */
  const [verdicts, setVerdicts] = useState<Record<string, true | string>>({});
  const [verifying, setVerifying] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (settings.loaded && form === null) setForm(initialFormSettings(settings.stored, settings.devProvider));
  }, [settings.loaded, settings.stored, settings.devProvider, form]);

  if (!settings.loaded || form === null) return null;

  const presetId: AppPresetId | null = isAppPresetId(form.presetId) ? form.presetId : null;
  const isDemo = presetId === DEMO_PRESET_ID;
  const needsKey = presetId ? presetNeedsKey(presetId) : true;
  const hasKey = settings.savedApiKey !== null;
  const update = (patch: Partial<StoredProviderSettings>) => setForm({ ...form, ...patch });

  const selectPreset = (id: AppPresetId) => {
    const preset = APP_PRESETS[id];
    setModels([]);
    setShowHidden(false);
    setVerdicts({});
    setConfirmRemove(false);
    setNotice(null);
    setKeyEditing(false);
    setApiKeyInput('');
    setForm({ presetId: id, baseUrl: preset.baseUrl, model: preset.defaultModel });
  };

  const summary = isDemo ? COPY.keyDemo : hasKey ? `${keyLabelOf(settings)} · ${COPY.keySaved}` : COPY.keyNone;

  const onSave = async () => {
    if (!presetId) return;
    const newKey = apiKeyInput.trim();
    const key = newKey || settings.savedApiKey || '';
    if (needsKey && !key) return setNotice({ tone: 'error', text: COPY.needKey });
    if (!form.baseUrl.trim()) return setNotice({ tone: 'error', text: COPY.needBaseUrl });
    if (!form.model.trim()) return setNotice({ tone: 'error', text: COPY.needModel });
    try {
      await settings.save({ presetId, baseUrl: form.baseUrl.trim(), model: form.model.trim() }, newKey || undefined);
      setApiKeyInput('');
      setKeyEditing(false);
      setNotice({ tone: 'ok', text: COPY.saved });
    } catch (e) {
      setNotice({ tone: 'error', text: COPY.saveError(messageOf(e)) });
    }
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
      : buildProviderConfig(presetId as Exclude<AppPresetId, 'demo'>, { apiKey: key, baseUrl: form.baseUrl, model: form.model });
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

  const onVerify = async () => {
    if (!presetId || isDemo || verifying) return;
    const key = apiKeyInput.trim() || settings.savedApiKey || settings.devProvider?.apiKey || '';
    if (needsKey && !key) return setNotice({ tone: 'error', text: COPY.needKeyToTest });
    if (!form.baseUrl.trim()) return setNotice({ tone: 'error', text: COPY.needBaseUrl });
    const model = form.model.trim();
    if (!model) return setNotice({ tone: 'error', text: COPY.needModel });
    setVerifying(true);
    try {
      await checkProviderModel(buildProviderConfig(presetId as Exclude<AppPresetId, 'demo'>, { apiKey: key, baseUrl: form.baseUrl, model }));
      setVerdicts((v) => ({ ...v, [model]: true }));
    } catch (e) {
      setVerdicts((v) => ({ ...v, [model]: messageOf(e) }));
    } finally {
      setVerifying(false);
    }
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
    const ordered = orderModelListings(models, presetId ? APP_PRESETS[presetId].defaultModel : undefined);
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
            const mark = verdict === undefined ? '' : verdict === true ? '✓ ' : '✗ ';
            return (
              <Pill
                key={m.id}
                testID={`model-chip-${m.id}`}
                label={mark + m.id}
                variant={m.id === form.model ? 'suggest' : m.usable ? 'default' : 'dashed'}
                onPress={() => update({ model: m.id })}
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

    const verdict = verdicts[form.model.trim()];

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
              onChangeText={(model) => update({ model })}
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
            <LinkButton testID="settings-verify" label={verifying ? COPY.verifying : COPY.verify} onPress={onVerify} />
            {verdict !== undefined ? (
              <Txt v="meta" tint={verdict === true ? c.srcText : c.danger} testID="settings-verify-result" style={{ flexShrink: 1 }}>
                {verdict === true ? COPY.verifyOk : COPY.verifyFail(verdict)}
              </Txt>
            ) : null}
          </View>
        </Field>
        {modelChips}
        {notice ? (
          <Txt v="bodySm" tint={notice.tone === 'ok' ? c.srcText : c.danger} testID="settings-notice">{notice.text}</Txt>
        ) : null}
        <FormButton testID="settings-save" label={COPY.save} onPress={onSave} />
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
