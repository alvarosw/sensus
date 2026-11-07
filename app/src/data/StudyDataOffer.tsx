// Oferta dos dados de estudo: o conteúdo da tela data-setup, reaproveitado pelo passo de dados do onboarding.
// Quem chama decide o que "Depois" e "Continuar" fazem (a tela volta; o onboarding avança).
import { useEffect } from 'react';
import { View } from 'react-native';
import { Card, Txt } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { DownloadStatus } from './DownloadStatus';
import { useDataStore } from './data-store';
import { formatMB } from './plan';
import { DATA_COPY } from './strings';

export interface StudyDataOfferProps {
  /** "Depois": não oferecer de novo esta versão (quem chama grava e segue). */
  onLater: () => void;
  /** Durante o download: botão para seguir adiante enquanto ele continua (o onboarding usa). */
  background?: { label: string; onPress: () => void };
  /** Download concluído (ou "Continuar" depois dele). */
  onDone: () => void;
}

export function StudyDataOffer({ onLater, onDone, background }: StudyDataOfferProps) {
  const phase = useDataStore((s) => s.machine.phase);
  const manifest = useDataStore((s) => s.manifest);
  const start = useDataStore((s) => s.start);
  const refreshManifest = useDataStore((s) => s.refreshManifest);
  const installedSize = useDataStore((s) => s.installed?.sizeBytes ?? 0);

  useEffect(() => {
    if (!manifest) void refreshManifest();
  }, [manifest, refreshManifest]);

  const downloadLine = manifest ? formatMB(manifest.full.size) : null;
  const installedLine = manifest ? formatMB(manifest.full.uncompressed_size) : formatMB(installedSize);
  const sizeText = downloadLine ? DATA_COPY.sizeLine(downloadLine, installedLine) : DATA_COPY.sizeUnknown;

  return (
    <View style={{ gap: 18 }}>
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
          <FormButton testID="data-setup-later" variant="secondary" label={DATA_COPY.later} onPress={onLater} />
        </View>
      ) : null}

      {phase !== 'idle' && phase !== 'done' ? (
        <View style={{ gap: 12 }}>
          <DownloadStatus testID="data-setup-status" />
          {phase === 'paused' || phase === 'error' ? (
            <FormButton testID="data-setup-later-2" variant="secondary" label={DATA_COPY.later} onPress={onLater} />
          ) : background ? (
            <FormButton testID="data-setup-background" variant="secondary" label={background.label} onPress={background.onPress} />
          ) : null}
        </View>
      ) : null}

      {phase === 'done' ? (
        <View style={{ gap: 12 }}>
          <DownloadStatus testID="data-setup-status" />
          <FormButton testID="data-setup-continue" label={DATA_COPY.continue} onPress={onDone} />
        </View>
      ) : null}
    </View>
  );
}
