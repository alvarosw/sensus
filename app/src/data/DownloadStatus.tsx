// Situação do download na interface: progresso, pausa, erro e conclusão. Usado pela tela de primeira vez,
// pela tela de Dados de estudo e pelo cartão da folha de estudo. A ação de iniciar fica com quem chama.
import { ActivityIndicator, View } from 'react-native';
import { LinkButton, Txt, useTheme } from '@/design';
import { FormButton } from '@/features/common/Buttons';
import { spaceNeeded, formatMB } from './plan';
import { useDataStore } from './data-store';
import { DATA_COPY } from './strings';
import { percentOf, progressLine } from './view';

export function DownloadStatus({ testID = 'data-status' }: { testID?: string }) {
  const { c } = useTheme();
  const machine = useDataStore((s) => s.machine);
  const manifest = useDataStore((s) => s.manifest);
  const cancel = useDataStore((s) => s.cancel);
  const start = useDataStore((s) => s.start);
  const discardDownload = useDataStore((s) => s.discardDownload);
  const { phase } = machine;

  if (phase === 'idle') return null;

  if (phase === 'done') {
    return (
      <Txt testID={testID} v="bodySm" tint={c.accent} bold>
        {DATA_COPY.done}
      </Txt>
    );
  }

  if (phase === 'error' && machine.error) {
    const need = manifest ? formatMB(spaceNeeded(manifest.full.size, manifest.full.uncompressed_size)) : '';
    const message = machine.error === 'space' ? DATA_COPY.errors.space(need) : DATA_COPY.errors[machine.error];
    return (
      <View testID={testID} style={{ gap: 10 }}>
        <Txt v="bodySm" tint={c.danger}>{message}</Txt>
        <FormButton testID={`${testID}-retry`} label={DATA_COPY.retry} onPress={start} />
      </View>
    );
  }

  if (phase === 'paused') {
    return (
      <View testID={testID} style={{ gap: 10 }}>
        <Txt v="bodySm" color="muted">{DATA_COPY.paused[machine.pause ?? 'user']}</Txt>
        {machine.total > 0 ? <Txt v="meta" color="muted">{progressLine(machine)}</Txt> : null}
        <FormButton testID={`${testID}-resume`} label={DATA_COPY.resume} onPress={start} />
        <LinkButton testID={`${testID}-discard`} tone="danger" label={DATA_COPY.discard} onPress={discardDownload} />
      </View>
    );
  }

  if (phase === 'downloading') {
    const pct = percentOf(machine);
    return (
      <View testID={testID} style={{ gap: 8 }}>
        <Txt v="bodySm" bold testID={`${testID}-percent`}>{DATA_COPY.progress(pct)}</Txt>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.accent }} />
        </View>
        <Txt v="meta" color="muted">{progressLine(machine)}</Txt>
        <LinkButton testID={`${testID}-cancel`} label={DATA_COPY.cancel} onPress={cancel} />
      </View>
    );
  }

  // Checando, conferindo, descompactando ou instalando: sem progresso por bytes.
  const label =
    phase === 'checking'
      ? DATA_COPY.phases.checking
      : phase === 'verifying'
        ? DATA_COPY.phases.verifying
        : phase === 'extracting'
          ? DATA_COPY.phases.extracting
          : DATA_COPY.phases.installing;
  return (
    <View testID={testID} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ActivityIndicator color={c.muted} />
        <Txt v="bodySm" color="muted">{label}</Txt>
      </View>
      {phase === 'checking' ? <LinkButton testID={`${testID}-cancel`} label={DATA_COPY.cancel} onPress={cancel} /> : null}
    </View>
  );
}
