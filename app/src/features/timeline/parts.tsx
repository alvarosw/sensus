// Peças visuais da linha do tempo: cartões de linha, estrela de favorito, marca de tipo, chips, busca e densidade.
// Cores só dos tokens (useTheme): tipo de linha usa as cores de fonte (período = entidade, pessoa = comentário,
// lugar = léxico), favoritos e o trecho atual usam o accent.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { TimelineLine } from '@sensus/core';
import { Icon, Txt, fontFamilies, radius, size, space, useTheme, type SourceTypeColors } from '@/design';
import { StudyDataPrompt } from '@/data/StudyDataPrompt';
import { useEdition } from '@/data/db-context';
import { TL } from './strings';
import { spanText } from './model';
import { useTimelineName } from '@/translate/timeline-translate';

export type LineKind = TimelineLine['kind'];

/** Cor do tipo de linha (chave de st, as cores de fonte): período, pessoa e lugar. */
export function kindColor(kind: LineKind, st: SourceTypeColors): string {
  return kind === 'period' ? st.ent : kind === 'person' ? st.com : st.tok;
}

/** Abreviação do tipo na marca quadrada (proto: P, Pe, L). */
const KIND_MARK: Record<LineKind, string> = { period: 'P', person: 'Pe', place: 'L' };

/** Portão: no banco de leitura não há linha do tempo; mostra o convite para baixar os dados. */
export function TimelineGate({ children }: { children: ReactNode }) {
  const edition = useEdition();
  const router = useRouter();
  if (edition === 'reader') return <StudyDataPrompt onClose={() => router.back()} />;
  return <>{children}</>;
}

/** Estrela de favorito (toque de 44 px). */
export function StarButton({ on, label, onPress, testID }: { on: boolean; label: string; onPress: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size.minTouch,
        height: size.minTouch,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Txt v="lensTitle" tint={on ? c.accent : c.muted} style={{ fontSize: 19, lineHeight: 22 }}>
        {on ? '★' : '☆'}
      </Txt>
    </Pressable>
  );
}

/** Marca quadrada do tipo de linha (P, Pe, L) ou do bloco da Bíblia inteira (∑, ≡). */
export function KindMark({ kind, glyph, small }: { kind?: LineKind; glyph?: string; small?: boolean }) {
  const { c, st } = useTheme();
  const color = kind ? kindColor(kind, st) : c.accent;
  const bg = kind ? color : c.chip;
  const dim = small ? 24 : 34;
  return (
    <View
      style={{
        width: dim,
        height: dim,
        borderRadius: small ? 7 : 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: kind ? `${bg}2E` : bg,
      }}
    >
      <Txt v="meta" bold tint={kind ? color : c.accent} style={{ fontSize: small ? 10 : 12, lineHeight: small ? 12 : 14 }}>
        {glyph ?? KIND_MARK[kind!]}
      </Txt>
    </View>
  );
}

/** Cartão de linha do tempo (lista da tela inicial e resultados). Toque abre a lista; a estrela favorita. */
export function LineCard({
  line,
  favorite,
  onOpen,
  onFavorite,
}: {
  line: TimelineLine;
  favorite: boolean;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  const { c } = useTheme();
  const name = useTimelineName(line);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[5],
        marginHorizontal: space[4],
        marginBottom: space[4],
        paddingLeft: space[5],
        paddingRight: space[2],
        paddingVertical: space[4],
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      <Pressable
        testID={`tl-line-${line.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${TL.kindLabel[line.kind]}, ${TL.lineTitleOf(line.count)}`}
        onPress={onOpen}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space[5], opacity: pressed ? 0.7 : 1 })}
      >
        <KindMark kind={line.kind} />
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Txt v="lensTitle" tint={c.text} numberOfLines={1} style={{ fontSize: 15.5, lineHeight: 20 }}>
            {name}
          </Txt>
          <Txt v="meta" color="muted" numberOfLines={1}>
            {`${TL.kindLabel[line.kind]} · ${TL.lineTitleOf(line.count)} · ${spanText(line.from, line.to)}`}
          </Txt>
        </View>
      </Pressable>
      <StarButton on={favorite} label={favorite ? TL.unfavorite : TL.favoriteLine(name)} onPress={onFavorite} testID={`tl-fav-line-${line.id}`} />
    </View>
  );
}

/** Pílula de filtro (um toque liga/desliga). */
export function Chip({
  label,
  on,
  onPress,
  testID,
  star,
  disabled,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  testID?: string;
  star?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const bg = on ? (star ? c.accent : c.text) : c.surface;
  const fg = on ? (star ? c.accentText : c.bg) : c.muted;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        minHeight: 34,
        paddingHorizontal: space[5],
        paddingVertical: space[2],
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: on ? bg : c.border,
        backgroundColor: bg,
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Txt v="button" tint={fg} style={{ fontSize: 12.5, lineHeight: 16 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Linha horizontal de pílulas com rolagem (sem barra). */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[3], paddingHorizontal: space[8] }}>
      {children}
    </ScrollView>
  );
}

/** Campo de busca (ícone de lupa e botão de limpar). */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  testID,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[4],
        height: 42,
        paddingHorizontal: space[5],
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      <Icon name="search" size={16} color={c.muted} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: fontFamilies.uiSemibold, fontSize: 14, paddingVertical: 0 }}
      />
      {value.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel={TL.clearSearch} onPress={() => onChangeText('')} hitSlop={8} style={{ paddingHorizontal: 4 }}>
          <Txt v="meta" color="muted" style={{ fontSize: 14 }}>✕</Txt>
        </Pressable>
      )}
    </View>
  );
}

/** Histograma de densidade: barras proporcionais ao maior valor. */
export function Density({ bins, height = 18, color }: { bins: readonly number[]; height?: number; color: string }) {
  const max = Math.max(1, ...bins);
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
      {bins.map((n, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(n > 0 ? 2 : 1, (n / max) * height),
            borderRadius: 1,
            backgroundColor: color,
            opacity: n > 0 ? 0.75 : 0.25,
          }}
        />
      ))}
    </View>
  );
}

/** Rodapé de atribuição e de datas (toda tela da linha do tempo). */
export function SourceFooter({ text = TL.footer }: { text?: string }) {
  return (
    <Txt v="meta" color="muted" style={{ fontSize: 11, lineHeight: 16, marginHorizontal: space[8], marginTop: space[6] }}>
      {text}
    </Txt>
  );
}

/** Tipo, contagem e intervalo da linha, em uma linha de texto (cabeçalhos e cartões). */
export function lineMetaText(line: TimelineLine): string {
  return `${TL.kindLabel[line.kind]} · ${TL.lineTitleOf(line.count)} · ${spanText(line.from, line.to)}`;
}

/** Chip de linha escolhida: bolinha da cor do tipo, nome e × para tirar. Usado no paralelo e no seletor. */
export function LaneChip({ testID, name, color, onRemove }: { testID: string; name: string; color: string; onRemove: () => void }) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 34, paddingLeft: space[5], paddingRight: space[2], borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, maxWidth: '100%' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Txt v="button" style={{ fontSize: 12.5, lineHeight: 16, flexShrink: 1 }} numberOfLines={1}>{name}</Txt>
      <Pressable
        testID={`${testID}-remove`}
        accessibilityRole="button"
        accessibilityLabel={TL.removeLane(name)}
        onPress={onRemove}
        hitSlop={8}
        style={({ pressed }) => ({ width: 26, height: 26, borderRadius: 13, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
      >
        <Txt v="button" color="muted" style={{ fontSize: 13, lineHeight: 15 }}>×</Txt>
      </Pressable>
    </View>
  );
}
