import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { buildProviderConfig, PRESET_IDS, PROVIDER_PRESETS, type PresetId } from '@sensus/core';
import { t } from '@/i18n';
import { listProviderModels } from '@/ai/client';
import { initialFormSettings, isPresetId } from '@/settings/resolve';
import { useSettings } from '@/settings/settings-context';
import type { StoredProviderSettings } from '@/settings/provider-store';
import { Button, Card, Chip, Heading } from '@/ui/primitives';
import { Body, Label, Meta } from '@/ui/text';
import { LoadingView } from '@/ui/state';
import { useTheme } from '@/ui/theme';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const MAX_MODEL_CHIPS = 25;

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export default function SettingsScreen() {
  const theme = useTheme();
  const settings = useSettings();

  const [form, setForm] = useState<StoredProviderSettings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  // Preenche o formulário uma vez, quando as configurações terminam de carregar.
  useEffect(() => {
    if (settings.loaded && form === null) {
      setForm(initialFormSettings(settings.stored, settings.devProvider));
    }
  }, [settings.loaded, settings.stored, settings.devProvider, form]);

  if (!settings.loaded || form === null) return <LoadingView />;

  const presetId: PresetId | null = isPresetId(form.presetId) ? form.presetId : null;
  const update = (patch: Partial<StoredProviderSettings>) => setForm({ ...form, ...patch });

  const selectPreset = (id: PresetId) => {
    const preset = PROVIDER_PRESETS[id];
    setModels([]);
    setForm({ presetId: id, baseUrl: preset.baseUrl, model: preset.defaultModel });
  };

  const onSave = async () => {
    const newKey = apiKeyInput.trim();
    const key = newKey || settings.savedApiKey || '';
    if (!presetId) return;
    if (!key) {
      setNotice({ tone: 'error', text: t('settings.needKey') });
      return;
    }
    if (!form.baseUrl.trim()) {
      setNotice({ tone: 'error', text: t('settings.needBaseUrl') });
      return;
    }
    if (!form.model.trim()) {
      setNotice({ tone: 'error', text: t('settings.needModel') });
      return;
    }
    try {
      await settings.save(
        { presetId, baseUrl: form.baseUrl.trim(), model: form.model.trim() },
        newKey || undefined,
      );
      setApiKeyInput('');
      setNotice({ tone: 'ok', text: t('settings.saved') });
    } catch (e) {
      setNotice({ tone: 'error', text: t('settings.saveError', { message: messageOf(e) }) });
    }
  };

  const onTest = async () => {
    if (!presetId) return;
    const key = apiKeyInput.trim() || settings.savedApiKey || settings.devProvider?.apiKey || '';
    if (!key) {
      setNotice({ tone: 'error', text: t('settings.needKey') });
      return;
    }
    if (!form.baseUrl.trim()) {
      setNotice({ tone: 'error', text: t('settings.needBaseUrl') });
      return;
    }
    // A listagem de modelos não exige modelo escolhido.
    const config = buildProviderConfig(presetId, { apiKey: key, baseUrl: form.baseUrl, model: form.model });
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

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.text,
    backgroundColor: theme.bg,
    fontSize: 15,
  } as const;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Card style={{ gap: 6 }}>
        <Body>{t('settings.byokHint')}</Body>
        <Meta>{t('settings.status', { state })}</Meta>
      </Card>

      <Card style={{ gap: 12 }}>
        <Heading level={3}>{t('settings.provider')}</Heading>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRESET_IDS.map((id) => (
            <Chip
              key={id}
              label={PROVIDER_PRESETS[id].label}
              selected={id === presetId}
              onPress={() => selectPreset(id)}
            />
          ))}
        </View>

        <Label>{t('settings.baseUrl')}</Label>
        <TextInput
          value={form.baseUrl}
          onChangeText={(baseUrl) => update({ baseUrl })}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={inputStyle}
        />

        <Label>{t('settings.model')}</Label>
        <TextInput
          value={form.model}
          onChangeText={(model) => update({ model })}
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <Heading level={3}>{t('settings.apiKey')}</Heading>
        <TextInput
          value={apiKeyInput}
          onChangeText={setApiKeyInput}
          placeholder={hasKey ? '••••••••' : t('settings.apiKeyPlaceholder')}
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          style={inputStyle}
        />
        {hasKey ? <Meta>{t('settings.apiKeySaved')}</Meta> : null}
        {!hasKey && settings.devProvider ? <Meta>{t('settings.apiKeyDev')}</Meta> : null}
        {hasKey ? <Button label={t('settings.removeKey')} variant="ghost" onPress={onRemoveKey} /> : null}
      </Card>

      {models.length > 0 ? (
        <Card style={{ gap: 10 }}>
          <Label>{t('settings.pickModel')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {models.slice(0, MAX_MODEL_CHIPS).map((id) => (
              <Chip
                key={id}
                label={id}
                selected={id === form.model}
                onPress={() => update({ model: id })}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {notice ? (
        <Text
          style={{
            color: notice.tone === 'ok' ? theme.sourceChipText : theme.danger,
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          {notice.text}
        </Text>
      ) : null}

      <View style={{ gap: 10 }}>
        <Button label={t('settings.save')} onPress={onSave} />
        <Button
          label={testing ? t('settings.testing') : t('settings.test')}
          variant="secondary"
          onPress={onTest}
          loading={testing}
        />
      </View>
    </ScrollView>
  );
}
