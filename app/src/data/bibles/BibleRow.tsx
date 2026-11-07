// Uma Bíblia na lista (Configurações > Bíblias e o passo de Bíblia da apresentação): nome, sigla, idioma, licença e
// tamanho, com um botão de ícone à direita (baixar; progresso que para o download; tentar de novo; lixeira quando
// baixada). Tocar numa baixada a torna a principal; a principal tem borda e o rótulo "Principal".
import { ActivityIndicator, Pressable, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { Icon, LinkButton, radius, Tag, Txt, useTheme, type IconName } from '@/design';
import type { MachineState } from '../download-machine';
import { formatMB } from '../plan';
import { percentOf } from '../view';
import { langName, type BibleRowInfo } from './bible-model';
import { BIBLE_COPY } from './strings';

export interface BibleRowProps {
  info: BibleRowInfo;
  installed: boolean;
  /** É a Bíblia principal (o texto do leitor). */
  principal: boolean;
  /** Instalada, mas o catálogo tem versão mais nova: oferece baixar de novo (troca atômica, ver install.ts). */
  update?: boolean;
  /** Versão nova do catálogo, para a frase "Versão X disponível" (só com update). */
  updateVersion?: string;
  /** Selo "Recomendada". */
  badge: boolean;
  machine: MachineState;
  onInstall: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onSelect: () => void;
}

const BUTTON = 44;
const RING = 30;
const RING_STROKE = 2.5;

export function BibleRow({ info, installed, principal, update = false, updateVersion, badge, machine, onInstall, onCancel, onRemove, onSelect }: BibleRowProps) {
  const { c } = useTheme();
  const { phase } = machine;
  const busy = phase === 'downloading' || phase === 'checking' || phase === 'verifying' || phase === 'extracting' || phase === 'installing';
  const meta = [langName(info.lang), info.license ? BIBLE_COPY.license(info.license) : null, !installed && info.sizeBytes ? BIBLE_COPY.size(formatMB(info.sizeBytes)) : null]
    .filter((x): x is string => !!x)
    .join(' · ');
  const selectable = installed && !principal;

  return (
    <Pressable
      testID={`bible-row-${info.id}`}
      disabled={!selectable}
      onPress={onSelect}
      accessibilityRole={installed ? 'radio' : undefined}
      accessibilityState={installed ? { checked: principal } : undefined}
      accessibilityLabel={selectable ? BIBLE_COPY.setPrincipalA11y(info.name) : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 14,
        paddingRight: 6,
        paddingVertical: 12,
        borderRadius: radius.card,
        backgroundColor: pressed ? c.surfaceAlt : c.surface,
        // a borda da principal é mais grossa; as outras compensam no padding para o texto não pular ao trocar
        borderWidth: principal ? 2 : 1,
        margin: principal ? 0 : 1,
        borderColor: principal ? c.accent : c.border,
      })}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt v="body" bold>{info.name}</Txt>
          <Tag label={info.abbr} />
          {badge ? <Tag label={BIBLE_COPY.recommended} tone="tint" /> : null}
        </View>
        {meta ? <Txt v="meta" color="muted">{meta}</Txt> : null}
        {principal ? (
          <View testID={`bible-principal-${info.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <Icon name="check" size={13} color={c.accent} />
            <Txt v="meta" color="accent" bold>{BIBLE_COPY.principal}</Txt>
          </View>
        ) : null}
        <Status info={info} installed={installed} update={update} updateVersion={updateVersion} machine={machine} onInstall={onInstall} />
      </View>
      <Action info={info} installed={installed} busy={busy} machine={machine} onInstall={onInstall} onCancel={onCancel} onRemove={onRemove} />
    </Pressable>
  );
}

/** Linha de estado embaixo do nome: progresso, fase, pausa, erro ou versão nova. */
function Status({ info, installed, update, updateVersion, machine, onInstall }: Pick<BibleRowProps, 'info' | 'installed' | 'update' | 'updateVersion' | 'machine' | 'onInstall'>) {
  const { c } = useTheme();
  const { phase } = machine;
  if (phase === 'downloading') return <Txt v="meta" color="muted" testID={`bible-progress-${info.id}`}>{BIBLE_COPY.progress(percentOf(machine))}</Txt>;
  if (phase === 'checking' || phase === 'verifying' || phase === 'extracting' || phase === 'installing') {
    return <Txt v="meta" color="muted">{BIBLE_COPY.phases[phase]}</Txt>;
  }
  if (phase === 'paused') return <Txt v="meta" color="muted">{BIBLE_COPY.paused}</Txt>;
  if (phase === 'error' && machine.error) return <Txt v="meta" tint={c.danger} testID={`bible-error-${info.id}`}>{BIBLE_COPY.errors[machine.error]}</Txt>;
  if (installed && update) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {updateVersion ? <Txt v="meta" color="muted">{BIBLE_COPY.updateAvailable(updateVersion)}</Txt> : null}
        <LinkButton testID={`bible-update-${info.id}`} label={BIBLE_COPY.update} onPress={onInstall} />
      </View>
    );
  }
  return null;
}

/** Botão de ícone da direita. */
function Action({ info, installed, busy, machine, onInstall, onCancel, onRemove }: Pick<BibleRowProps, 'info' | 'installed' | 'machine' | 'onInstall' | 'onCancel' | 'onRemove'> & { busy: boolean }) {
  const { c } = useTheme();
  const { phase } = machine;
  const id = info.id;

  if (phase === 'downloading') {
    const pct = percentOf(machine);
    const r = (RING - RING_STROKE) / 2;
    const len = 2 * Math.PI * r;
    return (
      <IconButton testID={`bible-cancel-${id}`} label={BIBLE_COPY.cancelA11y(info.name)} onPress={onCancel}>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={c.border} strokeWidth={RING_STROKE} fill="none" />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={c.accent}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${len} ${len}`}
            strokeDashoffset={len * (1 - Math.max(0.03, pct / 100))}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
          <Rect x={RING / 2 - 4.5} y={RING / 2 - 4.5} width={9} height={9} rx={1.5} fill={c.accent} />
        </Svg>
      </IconButton>
    );
  }
  if (busy) {
    return (
      <View style={{ width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.muted} />
      </View>
    );
  }
  if (phase === 'paused' || phase === 'error') {
    return <IconButton testID={`bible-retry-${id}`} icon="retry" color={c.accent} label={BIBLE_COPY.retryA11y(info.name)} onPress={onInstall} />;
  }
  if (installed) {
    return <IconButton testID={`bible-remove-${id}`} icon="trash" color={c.muted} label={BIBLE_COPY.removeA11y(info.name)} onPress={onRemove} />;
  }
  if (!info.downloadable) return null;
  return <IconButton testID={`bible-install-${id}`} icon="download" color={c.accent} label={BIBLE_COPY.downloadA11y(info.name)} onPress={onInstall} filled />;
}

function IconButton({
  icon,
  color,
  label,
  onPress,
  testID,
  filled = false,
  children,
}: {
  icon?: IconName;
  color?: string;
  label: string;
  onPress: () => void;
  testID: string;
  filled?: boolean;
  children?: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: BUTTON,
        height: BUTTON,
        borderRadius: BUTTON / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? c.tint : 'transparent',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {children ?? (icon && color ? <Icon name={icon} size={21} color={color} /> : null)}
    </Pressable>
  );
}
