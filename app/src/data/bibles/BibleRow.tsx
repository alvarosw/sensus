// Uma Bíblia na lista de Configurações > Bíblias: nome, sigla, idioma, licença, tamanho e a ação (baixar, progresso,
// pausa, erro com tentar de novo, ou instalada com remover).
import { ActivityIndicator, View } from 'react-native';
import { LinkButton, StatusPill, Tag, Txt, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import type { MachineState } from '../download-machine';
import { formatMB } from '../plan';
import { percentOf } from '../view';
import { langName, type BibleRowInfo } from './bible-model';
import { BIBLE_COPY } from './strings';

export interface BibleRowProps {
  info: BibleRowInfo;
  installed: boolean;
  badge: boolean;
  first: boolean;
  machine: MachineState;
  onInstall: () => void;
  onCancel: () => void;
  onRemove: () => void;
}

export function BibleRow({ info, installed, badge, first, machine, onInstall, onCancel, onRemove }: BibleRowProps) {
  const { c } = useTheme();
  const meta = [langName(info.lang), info.license ? BIBLE_COPY.license(info.license) : null, info.sizeBytes ? BIBLE_COPY.size(formatMB(info.sizeBytes)) : null]
    .filter((x): x is string => !!x)
    .join(' · ');

  return (
    <View
      testID={`bible-row-${info.id}`}
      style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8, backgroundColor: c.surface, borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt v="body" bold>{info.name}</Txt>
        <Tag label={info.abbr} />
        {badge ? <Tag label={BIBLE_COPY.recommended} tone="tint" /> : null}
      </View>
      {meta ? <Txt v="meta" color="muted">{meta}</Txt> : null}
      <Actions
        info={info}
        installed={installed}
        machine={machine}
        onInstall={onInstall}
        onCancel={onCancel}
        onRemove={onRemove}
      />
    </View>
  );
}

function Actions({ info, installed, machine, onInstall, onCancel, onRemove }: Omit<BibleRowProps, 'first' | 'badge' | 'machine'> & { machine: MachineState }) {
  const { c } = useTheme();
  const id = info.id;

  if (installed) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <StatusPill testID={`bible-installed-${id}`} label={BIBLE_COPY.installed} tone="ok" />
        {info.bundled ? null : <LinkButton testID={`bible-remove-${id}`} tone="danger" label={BIBLE_COPY.remove} onPress={onRemove} />}
      </View>
    );
  }
  if (!info.downloadable) return null;

  const { phase } = machine;
  if (phase === 'downloading') {
    const pct = percentOf(machine);
    return (
      <View style={{ gap: 6 }}>
        <Txt v="bodySm" bold testID={`bible-progress-${id}`}>{BIBLE_COPY.progress(pct)}</Txt>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.accent }} />
        </View>
        <LinkButton testID={`bible-cancel-${id}`} label={BIBLE_COPY.cancel} onPress={onCancel} />
      </View>
    );
  }
  if (phase === 'checking' || phase === 'verifying' || phase === 'extracting' || phase === 'installing') {
    const label = BIBLE_COPY.phases[phase];
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ActivityIndicator color={c.muted} />
        <Txt v="bodySm" color="muted">{label}</Txt>
      </View>
    );
  }
  if (phase === 'paused') {
    return (
      <View style={{ gap: 8 }}>
        <Txt v="bodySm" color="muted">{BIBLE_COPY.paused}</Txt>
        <FormButton testID={`bible-resume-${id}`} label={BIBLE_COPY.resume} onPress={onInstall} />
      </View>
    );
  }
  if (phase === 'error' && machine.error) {
    return (
      <View style={{ gap: 8 }}>
        <Txt v="bodySm" tint={c.danger} testID={`bible-error-${id}`}>{BIBLE_COPY.errors[machine.error]}</Txt>
        <FormButton testID={`bible-retry-${id}`} label={BIBLE_COPY.retry} onPress={onInstall} />
      </View>
    );
  }
  return <FormButton testID={`bible-install-${id}`} label={BIBLE_COPY.install} onPress={onInstall} />;
}
