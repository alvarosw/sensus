// Dados de estudo (Configurações): situação do banco completo, verificar atualização, baixar de novo e remover.
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Card, LinkButton, Txt, useTheme } from '@/design';
import { FormButton } from '@/features/common/Buttons';
import { DownloadStatus } from '@/data/DownloadStatus';
import { useDataStore, useUpdateState } from '@/data/data-store';
import { formatMB } from '@/data/plan';
import { DATA_COPY } from '@/data/strings';
import { isActive } from '@/data/download-machine';

function Line({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: c.border }}>
      <Txt v="bodySm" color="muted">{label}</Txt>
      <Txt v="bodySm">{value}</Txt>
    </View>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

export default function DataSettingsScreen() {
  const { c } = useTheme();
  const installed = useDataStore((s) => s.installed);
  const edition = useDataStore((s) => s.edition);
  const manifest = useDataStore((s) => s.manifest);
  const checking = useDataStore((s) => s.checking);
  const manifestError = useDataStore((s) => s.manifestError);
  const phase = useDataStore((s) => s.machine.phase);
  const refreshManifest = useDataStore((s) => s.refreshManifest);
  const start = useDataStore((s) => s.start);
  const remove = useDataStore((s) => s.remove);
  const updateState = useUpdateState();
  const [note, setNote] = useState<string | null>(null);
  const busy = isActive(phase);
  const isFull = edition === 'full';
  const downloaded = installed?.downloaded === true;

  const check = async () => {
    setNote(null);
    const m = await refreshManifest();
    if (!m) {
      setNote(DATA_COPY.checkFailed);
      return;
    }
    if (updateState === 'current') setNote(DATA_COPY.upToDate);
    else if (updateState === 'unknown') setNote(DATA_COPY.unknownVersion);
    else setNote(DATA_COPY.updateAvailable(m.data_version, formatMB(m.full.size)));
  };

  const confirmRemove = () => {
    Alert.alert(DATA_COPY.removeTitle, DATA_COPY.removeBody, [
      { text: DATA_COPY.cancel, style: 'cancel' },
      { text: DATA_COPY.removeConfirm, style: 'destructive', onPress: () => void remove() },
    ]);
  };

  const sizeText = installed && installed.sizeBytes > 0 ? formatMB(installed.sizeBytes) : '—';
  const versionText = installed?.dataVersion ?? '—';

  return (
    <ScrollView testID="settings-data" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 18 }} contentInsetAdjustmentBehavior="automatic">
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11 }}>
          <Txt v="bodySm" color="muted">{DATA_COPY.statusLabel}</Txt>
          <Txt v="bodySm" testID="data-status-label">{isFull ? DATA_COPY.statusFull : DATA_COPY.statusReader}</Txt>
        </View>
        {isFull ? (
          <>
            <Line label={DATA_COPY.version} value={versionText} />
            <Line label={DATA_COPY.updatedAt} value={formatDate(installed?.installedAt ?? null)} />
            <Line label={DATA_COPY.installedSize} value={sizeText} />
          </>
        ) : null}
      </Card>

      <Txt v="bodySm" color="muted">{DATA_COPY.settingsNote}</Txt>

      <View style={{ gap: 12 }}>
        {!busy ? (
          <FormButton testID="data-check" variant="secondary" label={checking ? DATA_COPY.checking : DATA_COPY.check} onPress={() => void check()} disabled={checking} />
        ) : null}
        {note ? <Txt v="bodySm" color={manifestError && !manifest ? 'danger' : 'muted'} testID="data-check-note">{note}</Txt> : null}

        {!isFull && !busy ? <FormButton testID="data-download" label={DATA_COPY.download} onPress={start} /> : null}
        {isFull && !busy ? <FormButton testID="data-redownload" variant="secondary" label={DATA_COPY.redownload} onPress={start} /> : null}
        {isFull && updateState === 'available' && !busy ? (
          <FormButton testID="data-update" label={DATA_COPY.update} onPress={start} />
        ) : null}

        <DownloadStatus testID="data-status" />

        {downloaded && !busy ? <LinkButton testID="data-remove" tone="danger" label={DATA_COPY.remove} onPress={confirmRemove} /> : null}
      </View>
    </ScrollView>
  );
}
