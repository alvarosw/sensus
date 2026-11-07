// Configuração da tradução automática (Aparência e leitura): liga/desliga, o par de idiomas atual, a situação do
// modelo do idioma do app, o download e a remoção.
import { useEffect } from 'react';
import { Alert, Switch, View } from 'react-native';
import { appLangInfo, modelPairOf } from '@sensus/core';
import { Card, LinkButton, Txt, useTheme } from '@/design';
import { useLang } from '@/i18n/lang-store';
import { ensureTranslateLoaded, useTranslate, type ModelStatus } from './store';
import { translationSupported } from './native';
import { TR } from './strings';

function statusLabel(model: ModelStatus): string {
  switch (model) {
    case 'ready':
      return `${TR.modelReady} · ${TR.modelSize}`;
    case 'downloading':
      return TR.modelDownloading;
    case 'error':
      return TR.modelError;
    case 'on-demand':
      return TR.modelOnDemand;
    default:
      return `${TR.modelMissing} · ${TR.modelSize}`;
  }
}

export function TranslateSettingsCard() {
  const { c } = useTheme();
  const lang = useLang();
  const enabled = useTranslate((s) => s.enabled);
  const model = useTranslate((s) => s.model);
  const setEnabled = useTranslate((s) => s.setEnabled);
  const downloadModel = useTranslate((s) => s.downloadModel);
  const removeModel = useTranslate((s) => s.removeModel);

  useEffect(() => {
    ensureTranslateLoaded();
  }, []);

  if (!translationSupported) {
    return (
      <Card testID="translate-settings">
        <Txt v="bodySm" color="muted">{TR.unavailable}</Txt>
      </Card>
    );
  }

  // Par do modelo que esta tela gerencia: inglês -> idioma do app (com o app em inglês, não há par próprio).
  const pair = modelPairOf(lang);
  const confirmRemove = () => {
    Alert.alert(TR.removeTitle, TR.removeBody, [
      { text: TR.cancel, style: 'cancel' },
      { text: TR.removeConfirm, style: 'destructive', onPress: () => void removeModel() },
    ]);
  };

  return (
    <Card style={{ gap: 12 }} testID="translate-settings">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt v="bodySm" bold>{TR.settingsToggle}</Txt>
        </View>
        <Switch
          testID="translate-toggle"
          value={enabled}
          onValueChange={(on) => void setEnabled(on)}
          disabled={model === 'downloading'}
          trackColor={{ false: c.border, true: c.accent }}
          thumbColor={c.surface}
          accessibilityLabel={TR.settingsToggle}
        />
      </View>
      {pair ? (
        <Txt v="bodySm" testID="translate-pair">
          {TR.settingsPair(appLangInfo(pair.from).endonym, appLangInfo(pair.to).endonym)}
        </Txt>
      ) : null}
      <Txt v="bodySm" color="muted" testID="translate-model-status">{statusLabel(model)}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 }}>
        {model === 'missing' || model === 'error' ? (
          <LinkButton testID="translate-download" label={TR.downloadModel} onPress={() => void downloadModel()} />
        ) : null}
        {model === 'ready' ? (
          <LinkButton testID="translate-remove" label={TR.removeModel} tone="danger" onPress={confirmRemove} />
        ) : null}
      </View>
      <Txt v="meta" color="muted" style={{ fontSize: 12, lineHeight: 17 }}>{TR.settingsHelp}</Txt>
    </Card>
  );
}
