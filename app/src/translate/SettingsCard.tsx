// Configuração da tradução automática (Aparência e leitura): liga/desliga, situação do modelo e remoção.
import { useEffect } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Card, LinkButton, Txt, useTheme } from '@/design';
import { ensureTranslateLoaded, useTranslate } from './store';
import { translationSupported } from './native';
import { TR } from './strings';

function statusLabel(model: string): string {
  switch (model) {
    case 'ready':
      return `${TR.modelReady} · ${TR.modelSize}`;
    case 'downloading':
      return TR.modelDownloading;
    case 'error':
      return TR.modelError;
    default:
      return `${TR.modelMissing} · ${TR.modelSize}`;
  }
}

export function TranslateSettingsCard() {
  const { c } = useTheme();
  const enabled = useTranslate((s) => s.enabled);
  const model = useTranslate((s) => s.model);
  const setEnabled = useTranslate((s) => s.setEnabled);
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
      <Txt v="bodySm" color="muted" testID="translate-model-status">{statusLabel(model)}</Txt>
      {model === 'ready' ? (
        <View style={{ flexDirection: 'row' }}>
          <LinkButton testID="translate-remove" label={TR.removeModel} tone="danger" onPress={confirmRemove} />
        </View>
      ) : null}
      <Txt v="meta" color="muted" style={{ fontSize: 12, lineHeight: 17 }}>{TR.settingsHelp}</Txt>
    </Card>
  );
}
