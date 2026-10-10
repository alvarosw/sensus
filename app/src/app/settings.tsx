// Configurações de IA e aparência, com o design system (tokens e componentes de src/design).
import { useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { buildProviderConfig } from '@sensus/core';
import { Card, fontFamilies, Pill, radius, Segmented, Txt, useTheme, type SchemePreference } from '@/design';
import { t } from '@/i18n';
import { listProviderModels } from '@/ai/client';
import { initialFormSettings } from '@/settings/resolve';
import { APP_PRESET_IDS, APP_PRESETS, DEMO_PRESET_ID, isAppPresetId, presetNeedsKey, type AppPresetId } from '@/settings/presets';
import { DEMO_PROVIDER_CONFIG } from '@/ai/demo-provider';
import { useSettings } from '@/settings/settings-context';
import type { StoredProviderSettings } from '@/settings/provider-store';
import { FormButton } from '@/features/common/Buttons';
import { SETTINGS } from '@/features/common/strings';
import { ChatGPTCard } from '@/settings/chatgpt-card';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const MAX_MODEL_CHIPS = 25;

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt v="eyebrow" color="muted">{label}</Txt>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { c, preference, setPreference } = useTheme();
  const settings = useSettings();

  const [form, setForm] = useState<StoredProviderSettings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    if (settings.loaded && form === null) setForm(initialFormSettings(settings.stored, settings.devProvider));
  }, [settings.loaded, settings.stored, settings.devProvider, form]);

  const inputStyle = {
    height: 44,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.xl,
    paddingHorizontal: 12,
    color: c.text,
    backgroundColor: c.bg,
    fontFamily: fontFamilies.ui,
    fontSize: 14,
  } as const;

  if (!settings.loaded || form === null) {
    return <View style={{ flex: 1, backgroundColor: c.bg }}><Txt v="body" color="muted" style={{ padding: 16 }}>{t('common.loading')}</Txt></View>;
  }

  const presetId: AppPresetId | null = isAppPresetId(form.presetId) ? form.presetId : null;
  const isDemo = presetId === DEMO_PRESET_ID;
  const needsKey = presetId ? presetNeedsKey(presetId) : true;
  const update = (patch: Partial<StoredProviderSettings>) => setForm({ ...form, ...patch });

  const selectPreset = (id: AppPresetId) => {
    const preset = APP_PRESETS[id];
    setModels([]);
    setNotice(null);
    setForm({ presetId: id, baseUrl: preset.baseUrl, model: preset.defaultModel });
  };

  const onSave = async () => {
    if (!presetId) return;
    const newKey = apiKeyInput.trim();
    const key = newKey || settings.savedApiKey || '';
    if (needsKey && !key) return setNotice({ tone: 'error', text: t('settings.needKey') });
    if (!form.baseUrl.trim()) return setNotice({ tone: 'error', text: t('settings.needBaseUrl') });
    if (!form.model.trim()) return setNotice({ tone: 'error', text: t('settings.needModel') });
    try {
      await settings.save({ presetId, baseUrl: form.baseUrl.trim(), model: form.model.trim() }, newKey || undefined);
      setApiKeyInput('');
      setNotice({ tone: 'ok', text: t('settings.saved') });
    } catch (e) {
      setNotice({ tone: 'error', text: t('settings.saveError', { message: messageOf(e) }) });
    }
  };

  const onTest = async () => {
    if (!presetId) return;
    const key = apiKeyInput.trim() || settings.savedApiKey || settings.devProvider?.apiKey || '';
    if (needsKey && !key) return setNotice({ tone: 'error', text: t('settings.needKey') });
    if (!form.baseUrl.trim()) return setNotice({ tone: 'error', text: t('settings.needBaseUrl') });
    const config = isDemo
      ? { ...DEMO_PROVIDER_CONFIG }
      : buildProviderConfig(presetId as Exclude<AppPresetId, 'demo'>, { apiKey: key, baseUrl: form.baseUrl, model: form.model });
    setTesting(true);
    setNotice(null);
    try {
      const found = await listProviderModels(config);
      setModels(found);
      setNotice({ tone: 'ok', text: t('settings.testOk', { count: found.length }) });
    } catch (e) {
      setModels([]);
      setNotice({ tone: 'error', text: t('settings.testFail', { message: messageOf(e) }) });
    } finally {
      setTesting(false);
    }
  };

  const onRemoveKey = async () => {
    await settings.removeApiKey();
    setNotice({ tone: 'ok', text: t('settings.keyRemoved') });
  };

  const hasKey = settings.savedApiKey !== null;
  const state = settings.provider ? t('settings.stateReady') : t('settings.stateMissing');

  return (
    <ScrollView
      testID="settings"
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <ChatGPTCard />

      <Txt v="eyebrow" color="muted" style={{ marginTop: 6 }}>Usar uma chave de API (alternativa)</Txt>

      <Card style={{ gap: 6 }}>
        <Txt v="bodySm">{t('settings.byokHint')}</Txt>
        <Txt v="meta" color="muted">{t('settings.status', { state })}</Txt>
      </Card>

      <Card style={{ gap: 14 }}>
        <Txt v="lensTitle">{t('settings.provider')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {APP_PRESET_IDS.map((id) => (
            <Pill
              key={id}
              testID={`preset-${id}`}
              label={APP_PRESETS[id].label}
              variant={id === presetId ? 'suggest' : 'default'}
              onPress={() => selectPreset(id)}
            />
          ))}
        </View>
        {isDemo ? <Txt v="bodySm" color="muted">{SETTINGS.demoHint}</Txt> : null}
        <Field label={t('settings.baseUrl')}>
          <TextInput
            testID="settings-base-url"
            value={form.baseUrl}
            onChangeText={(baseUrl) => update({ baseUrl })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!isDemo}
            style={[inputStyle, isDemo && { opacity: 0.6 }]}
          />
        </Field>
        <Field label={t('settings.model')}>
          <TextInput
            testID="settings-model"
            value={form.model}
            onChangeText={(model) => update({ model })}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isDemo}
            style={[inputStyle, isDemo && { opacity: 0.6 }]}
          />
        </Field>
      </Card>

      {needsKey ? (
        <Card style={{ gap: 10 }}>
          <Txt v="lensTitle">{t('settings.apiKey')}</Txt>
          <TextInput
            testID="settings-api-key"
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            placeholder={hasKey ? '••••••••' : t('settings.apiKeyPlaceholder')}
            placeholderTextColor={c.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            style={inputStyle}
          />
          {hasKey ? <Txt v="meta" color="muted">{t('settings.apiKeySaved')}</Txt> : null}
          {!hasKey && settings.devProvider ? <Txt v="meta" color="muted">{t('settings.apiKeyDev')}</Txt> : null}
          {hasKey ? <FormButton variant="ghost" label={t('settings.removeKey')} onPress={onRemoveKey} /> : null}
        </Card>
      ) : null}

      {models.length > 0 ? (
        <Card style={{ gap: 10 }}>
          <Txt v="eyebrow" color="muted">{t('settings.pickModel')}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {models.slice(0, MAX_MODEL_CHIPS).map((id) => (
              <Pill key={id} label={id} variant={id === form.model ? 'suggest' : 'default'} onPress={() => update({ model: id })} />
            ))}
          </View>
        </Card>
      ) : null}

      {notice ? (
        <Txt v="bodySm" tint={notice.tone === 'ok' ? c.srcText : c.danger} testID="settings-notice">{notice.text}</Txt>
      ) : null}

      <View style={{ gap: 8 }}>
        <FormButton testID="settings-save" label={t('settings.save')} onPress={onSave} />
        <FormButton
          testID="settings-test"
          variant="secondary"
          label={testing ? t('settings.testing') : t('settings.test')}
          disabled={testing}
          onPress={onTest}
        />
      </View>

      <Card style={{ gap: 10 }}>
        <Txt v="lensTitle">{SETTINGS.appearance}</Txt>
        <Txt v="eyebrow" color="muted">{SETTINGS.theme}</Txt>
        <Segmented<SchemePreference>
          testID="theme-pref"
          value={preference}
          onChange={setPreference}
          options={[
            { key: 'light', label: SETTINGS.light },
            { key: 'dark', label: SETTINGS.dark },
            { key: 'system', label: SETTINGS.system },
          ]}
        />
      </Card>
    </ScrollView>
  );
}
