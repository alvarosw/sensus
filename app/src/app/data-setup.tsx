// Primeira vez (e atualizações): oferece baixar os dados de estudo. "Depois" segue lendo com o banco de leitura
// e não repete a oferta para esta versão. Aberta pela tela principal (ver DataSetupGate em _layout.tsx).
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Txt, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { DownloadStatus } from '@/data/DownloadStatus';
import { useDataStore } from '@/data/data-store';
import { formatMB } from '@/data/plan';
import { DATA_COPY } from '@/data/strings';

export default function DataSetupScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const phase = useDataStore((s) => s.machine.phase);
  const manifest = useDataStore((s) => s.manifest);
  const start = useDataStore((s) => s.start);
  const deferOffer = useDataStore((s) => s.deferOffer);
  const refreshManifest = useDataStore((s) => s.refreshManifest);
  const installedSize = useDataStore((s) => s.installed?.sizeBytes ?? 0);

  useEffect(() => {
    if (!manifest) void refreshManifest();
  }, [manifest, refreshManifest]);

  const downloadLine = manifest ? formatMB(manifest.full.size) : null;
  const installedLine = manifest ? formatMB(manifest.full.uncompressed_size) : formatMB(installedSize);
  const sizeText = downloadLine ? DATA_COPY.sizeLine(downloadLine, installedLine) : DATA_COPY.sizeUnknown;
  const later = () => {
    deferOffer();
    router.back();
  };

  return (
    <ScrollView
      testID="screen-data-setup"
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28, gap: 18 }}
    >
      <Txt v="bookTitle" testID="data-setup-title">{DATA_COPY.title}</Txt>
      <Txt v="body" color="muted">{DATA_COPY.setupLead}</Txt>

      <Card style={{ gap: 10, paddingVertical: 14 }}>
        {DATA_COPY.includes.map((item) => (
          <View key={item} style={{ flexDirection: 'row', gap: 10 }}>
            <Txt v="body" color="muted">•</Txt>
            <Txt v="bodySm" style={{ flex: 1 }}>{item}</Txt>
          </View>
        ))}
      </Card>

      <Txt v="meta" color="muted" testID="data-setup-size">{sizeText}</Txt>

      {phase === 'idle' ? (
        <View style={{ gap: 10 }}>
          <FormButton testID="data-setup-download" label={DATA_COPY.download} onPress={start} />
          <FormButton testID="data-setup-later" variant="secondary" label={DATA_COPY.later} onPress={later} />
        </View>
      ) : null}

      {phase !== 'idle' && phase !== 'done' ? (
        <View style={{ gap: 12 }}>
          <DownloadStatus testID="data-setup-status" />
          {phase === 'paused' || phase === 'error' ? (
            <FormButton testID="data-setup-later-2" variant="secondary" label={DATA_COPY.later} onPress={later} />
          ) : null}
        </View>
      ) : null}

      {phase === 'done' ? (
        <View style={{ gap: 12 }}>
          <DownloadStatus testID="data-setup-status" />
          <FormButton testID="data-setup-continue" label={DATA_COPY.continue} onPress={() => router.back()} />
        </View>
      ) : null}
    </ScrollView>
  );
}
