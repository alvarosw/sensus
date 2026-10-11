// Componentes base do design system. Telas compõem estes blocos; estilos soltos só para layout.
// Cada componente corresponde a uma classe do protótipo (comentário "proto: .classe").
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './theme';
import { Icon, type IconName } from './icons';
import {
  fontFamilies,
  greekFor,
  radius,
  shadow,
  size,
  sourceTypeOf,
  space,
  type,
  type Palette,
  type SourceTypeColors,
  type TypeVariant,
} from './tokens';

type ColorKey = keyof Palette;

// ---- texto -----------------------------------------------------------------------------

export interface TxtProps extends TextProps {
  v?: TypeVariant;
  color?: ColorKey;
  /** Cor literal (ex.: cor de tipo de fonte). Prevalece sobre `color`. */
  tint?: string;
  bold?: boolean;
  italic?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

/** Texto tipado. `v` escolhe o papel tipográfico (tokens.type). */
export function Txt({ v = 'body', color = 'text', tint, bold, italic, center, style, ...rest }: TxtProps) {
  const { c } = useTheme();
  const t = type[v];
  const family = bold ? boldFamily(t.fontFamily) : italic ? italicFamily(t.fontFamily) : t.fontFamily;
  return (
    <Text
      {...rest}
      style={[
        t as TextStyle,
        { color: tint ?? c[color], fontFamily: family },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}

function boldFamily(f: string): string {
  if (f.startsWith('Literata')) return fontFamilies.readSemibold;
  if (f.startsWith('Manrope')) return fontFamilies.uiBold;
  if (f.startsWith('Gentium')) return fontFamilies.greekBold;
  return fontFamilies.monoMedium;
}
function italicFamily(f: string): string {
  return f.startsWith('Literata') ? fontFamilies.readItalic : f;
}

/**
 * Grego/hebraico inline (proto: .gr / .tgr). Sempre em Gentium, 6% maior que o texto ao redor.
 * Com onPress vira palavra tocável: cor de token e sublinhado pontilhado.
 */
export function Greek({
  children,
  base = 'claim',
  onPress,
  bold,
  testID,
}: {
  children: ReactNode;
  base?: TypeVariant;
  onPress?: () => void;
  bold?: boolean;
  testID?: string;
}) {
  const { c, st } = useTheme();
  const g = greekFor(type[base]);
  return (
    <Text
      testID={testID}
      onPress={onPress}
      suppressHighlighting={false}
      style={{
        fontFamily: bold ? fontFamilies.greekBold : g.fontFamily,
        fontSize: g.fontSize,
        color: onPress ? st.tok : c.text,
        textDecorationLine: onPress ? 'underline' : 'none',
        textDecorationStyle: 'dotted',
        textDecorationColor: st.tok,
      }}
    >
      {children}
    </Text>
  );
}

// ---- botões ----------------------------------------------------------------------------

function usePressStyle() {
  return ({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.6 : 1 });
}

/** Botão circular de ícone (proto: .icon-btn). */
export function IconButton({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const { c } = useTheme();
  const pressed = usePressStyle();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={(s) => [
        { width: size.iconButton, height: size.iconButton, borderRadius: size.iconButton / 2, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
        pressed(s),
      ]}
    >
      <Icon name={icon} size={13} color={c.muted} />
    </Pressable>
  );
}

/** Botão da barra superior (proto: .tb-btn). `active` = aria-pressed. */
export function TopBarButton({ children, label, active, onPress, testID }: { children: ReactNode; label: string; active?: boolean; onPress: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => ({
        height: size.topBarButton, minWidth: size.topBarButton, paddingHorizontal: space[4], borderRadius: radius.lg,
        alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.chip : 'transparent', opacity: pressed ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/** Pílula (proto: .pill-btn). suggest = ação recomendada; dashed = estado informativo. */
export function Pill({ label, onPress, variant = 'default', testID }: { label: string; onPress?: () => void; variant?: 'default' | 'suggest' | 'dashed'; testID?: string }) {
  const { c } = useTheme();
  const suggest = variant === 'suggest';
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1, borderStyle: variant === 'dashed' ? 'dashed' : 'solid', borderColor: suggest ? c.accent : c.border,
        backgroundColor: suggest ? c.selected : c.surface, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 4,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Txt v="button" color={suggest ? 'accent' : variant === 'dashed' ? 'muted' : 'text'} style={{ fontFamily: fontFamilies.uiSemibold }}>{label}</Txt>
    </Pressable>
  );
}

/** Botão de ação de lente/card (proto: .act / .act.deepen). `count` = total oculto ("Ver todos 12"). */
export function ActButton({ label, onPress, deepen, count, testID }: { label: string; onPress: () => void; deepen?: boolean; count?: number; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', gap: space[3], alignItems: 'center', borderWidth: 1, borderColor: deepen ? c.accent : c.border,
        backgroundColor: c.surface, borderRadius: radius.lg, paddingHorizontal: 11, paddingVertical: 6, opacity: pressed ? 0.6 : 1,
      })}
    >
      <Txt v="button" color={deepen ? 'accent' : 'text'}>{label}</Txt>
      {count != null && <Txt v="button" color="muted" style={{ fontFamily: fontFamilies.uiSemibold }}>{count}</Txt>}
    </Pressable>
  );
}

/** Ação de texto dentro de card (proto: .card-actions button). `danger` = ação destrutiva (ex.: Remover). */
export function LinkButton({ label, onPress, testID, tone = 'accent' }: { label: string; onPress: () => void; testID?: string; tone?: 'accent' | 'danger' }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} hitSlop={4} style={({ pressed }) => ({ paddingVertical: 4, paddingRight: 8, opacity: pressed ? 0.6 : 1 })}>
      <Txt v="button" color={tone}>{label}</Txt>
    </Pressable>
  );
}

/** Pergunta sugerida (proto: .q) — círculo "?" + texto. */
export function QuestionButton({ text, onPress, testID }: { text: string; onPress: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', gap: space[4], alignItems: 'flex-start', backgroundColor: c.inf, borderRadius: radius.xl,
        paddingHorizontal: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: c.infBorder, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Txt v="eyebrow" color="surface" style={{ letterSpacing: 0 }}>?</Txt>
      </View>
      <Txt v="bodySm" style={{ flex: 1 }}>{text}</Txt>
    </Pressable>
  );
}

// ---- dados compactos -----------------------------------------------------------------------

/** Fato numérico da folha em "espiar" (proto: .fact). `greek` = valor é uma palavra original. */
export function Fact({ value, label, greek, onPress, testID }: { value: string | number; label: string; greek?: boolean; onPress?: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ backgroundColor: c.surfaceAlt, borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 6, minWidth: 84, opacity: pressed ? 0.7 : 1 })}>
      {greek ? (
        <Text style={{ fontFamily: fontFamilies.greekBold, fontSize: 15, lineHeight: 20, color: c.text }}>{value}</Text>
      ) : (
        <Txt v="body" bold style={{ fontVariant: ['tabular-nums'] }}>{value}</Txt>
      )}
      <Txt v="meta" color="muted" numberOfLines={1} style={{ fontFamily: fontFamilies.ui, fontSize: 11 }}>{label}</Txt>
    </Pressable>
  );
}

/**
 * Pílula de citação inline (proto: .cite). Ponto colorido pelo tipo da fonte; `bad` = cite_id fora do contexto
 * (riscada em vermelho). Use dentro de <Text> para fluir com o parágrafo.
 *
 * Na web é a pílula com fundo. No Android/iOS, fundo e cantos arredondados num <Text> aninhado desenham-se
 * deslocados e invadem as linhas vizinhas quando o tamanho ou a altura de linha diferem do parágrafo. Por isso,
 * no nativo a pílula é só texto colorido (sem fundo, sem altura de linha própria), herdando a linha do pai.
 */
export function CitePill({ citeId, label, bad, onPress, greekLabel, testID }: { citeId: string; label: string; bad?: boolean; onPress?: () => void; greekLabel?: boolean; testID?: string }) {
  const { c, st } = useTheme();
  const dot = st[sourceTypeOf(citeId)];
  const web = Platform.OS === 'web';
  const cite = type.cite as TextStyle;
  const pill: TextStyle = web
    ? {
        ...cite,
        color: bad ? c.danger : c.srcText,
        backgroundColor: bad ? 'transparent' : c.src,
        textDecorationLine: bad ? 'line-through' : 'none',
        borderRadius: radius.sm,
        overflow: 'hidden',
      }
    : {
        fontFamily: cite.fontFamily,
        fontSize: cite.fontSize,
        color: bad ? c.danger : c.srcText,
        textDecorationLine: bad ? 'line-through' : 'none',
      };
  return (
    <Text testID={testID ?? `cite-${citeId}`} onPress={onPress} style={pill}>
      <Text style={{ color: bad ? c.danger : dot }}>{' ■ '}</Text>
      <Text style={greekLabel ? { fontFamily: fontFamilies.greekBold, fontSize: web ? 12 : cite.fontSize } : undefined}>{bad ? '?' : label}</Text>
      {' '}
    </Text>
  );
}

/** Marca de tipo no topo de cards (proto: .typemark): ponto + rótulo em caixa alta na cor do tipo. */
export function TypeMark({ kind, label }: { kind: keyof SourceTypeColors; label: string }) {
  const { st } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: st[kind] }} />
      <Txt v="eyebrow" tint={st[kind]} style={{ fontSize: 10.5 }}>{label}</Txt>
    </View>
  );
}

/** Etiqueta neutra (proto: .tchip / .scope-tag i). */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'tint' | 'warn' }) {
  const { c } = useTheme();
  const bg = tone === 'tint' ? c.tint : tone === 'warn' ? c.warn : c.surfaceAlt;
  const fg: ColorKey = tone === 'tint' ? 'tintText' : tone === 'warn' ? 'warnText' : 'muted';
  return (
    <View style={{ backgroundColor: bg, borderRadius: 5, paddingHorizontal: 6 }}>
      <Txt v="meta" color={fg} style={{ fontSize: 11 }}>{label}</Txt>
    </View>
  );
}

/** Selo de edição de texto (proto: .ed / .ed.tr). TR sempre destacado. */
export function EditionBadge({ edition }: { edition: string }) {
  const { c } = useTheme();
  const tr = edition === 'TR';
  return (
    <View style={{ backgroundColor: tr ? c.tint : c.surfaceAlt, borderRadius: radius.xs, paddingHorizontal: 5 }}>
      <Txt v="eyebrow" color={tr ? 'tintText' : 'muted'} style={{ fontSize: 10.5, letterSpacing: 0, textTransform: undefined }}>{edition}</Txt>
    </View>
  );
}

/** Pílula de morfologia em português (proto: .morph span). */
export function MorphPill({ label }: { label: string }) {
  const { c, st } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 5, overflow: 'hidden' }}>
      <View style={{ backgroundColor: st.tok + '24', paddingHorizontal: 6, paddingVertical: 1 }}>
        <Txt v="meta" tint={st.tok} style={{ fontSize: 11 }}>{label}</Txt>
      </View>
    </View>
  );
}

/** Barra de proporção (proto: .occ-bar / .rel i). value em 0..1. */
export function MeterBar({ value, color, width = 64, height = 6 }: { value: number; color: string; width?: number; height?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width, height, borderRadius: height / 2, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

// ---- estrutura -------------------------------------------------------------------------------

/** Card de fonte (proto: .card). */
export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  const { c } = useTheme();
  const base: ViewStyle = { borderWidth: 1, borderColor: c.border, borderRadius: radius.card, paddingHorizontal: 12, paddingVertical: 11, gap: space[3], backgroundColor: c.surface };
  if (!onPress) return <View testID={testID} style={[base, style]}>{children}</View>;
  return <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.75 : 1 }, style]}>{children}</Pressable>;
}

/** Linha de metadados no topo de um card (proto: .card-top). */
export function CardTop({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' }}>{children}</View>;
}

/** Sub-cabeçalho de grupo dentro de uma lente (proto: .sub-h), com ação opcional à direita. */
export function SubHeader({ label, action }: { label: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space[2] }}>
      <Txt v="eyebrow" color="muted">{label}</Txt>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={6}>
          <Txt v="meta" color="accent" bold>{action.label}</Txt>
        </Pressable>
      )}
    </View>
  );
}

/** Estado vazio (proto: .empty). */
export function Empty({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Txt v="bodySm" color="muted">{text}</Txt>
    </View>
  );
}

/** Controle segmentado (proto: .seg). */
export function Segmented<K extends string>({ options, value, onChange, testID }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: radius.lg, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            testID={testID ? `${testID}-${o.key}` : undefined}
            onPress={() => onChange(o.key)}
            style={[{ flex: 1, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, on && { backgroundColor: c.surface, ...shadow.segment }]}
          >
            <Txt v="button" color={on ? 'text' : 'muted'}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Linha de esqueleto com brilho (proto: .skel). */
export function Skeleton({ width = '100%', height = 12 }: { width?: ViewStyle['width']; height?: number }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={{ width, height, borderRadius: height / 2, backgroundColor: c.chip, opacity: v }} />;
}

/** Cursor piscante no fim de um texto em streaming (proto: .caret). Use dentro de <Text>. */
export function Caret() {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0, duration: 1, delay: 500, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 1, delay: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.Text style={{ opacity: v, color: c.accent }}>▍</Animated.Text>;
}

/**
 * Moldura de afirmação da IA (proto: .claim). kind vem de ClaimInfo:
 * - inference: fundo azul, borda esquerda e rótulo "Inferência" (o texto vem sem o rótulo);
 * - source / mixed: sem moldura. Em 'mixed', as frases sem fonte são sublinhadas em pontilhado pelo chamador
 *   (useUncitedStyle), sem rodapé: só as frases realmente sem citação aparecem;
 * - morphConflict: aviso âmbar com a análise do token citado.
 * onMore abre o menu ⋯ (Detalhar / De onde vem isso? / Perguntar sobre isto).
 */
export function ClaimFrame({
  kind,
  children,
  onMore,
  morphWarning,
  testID,
}: {
  kind: 'source' | 'inference' | 'mixed' | 'structure';
  children: ReactNode;
  onMore?: () => void;
  morphWarning?: string;
  testID?: string;
}) {
  const { c } = useTheme();
  const inference = kind === 'inference';
  return (
    <View testID={testID} style={{ gap: space[2] }}>
      <View
        style={[
          { position: 'relative', paddingRight: 26 },
          inference && { backgroundColor: c.inf, borderLeftWidth: 3, borderLeftColor: c.infBorder, borderTopRightRadius: radius.md, borderBottomRightRadius: radius.md, paddingVertical: 8, paddingLeft: 10, paddingRight: 30 },
        ]}
      >
        {inference && <Txt v="eyebrow" tint={c.infBorder} style={{ fontSize: 10.5, marginBottom: 2 }}>Inferência</Txt>}
        {children}
        {onMore && (
          <Pressable
            testID={testID ? `${testID}-more` : undefined}
            accessibilityRole="button"
            accessibilityLabel="Ações deste parágrafo"
            onPress={onMore}
            hitSlop={8}
            style={({ pressed }) => ({ position: 'absolute', right: inference ? 4 : 0, top: inference ? 6 : 2, width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.chip : 'transparent' })}
          >
            <Icon name="more" size={16} color={c.muted} />
          </Pressable>
        )}
      </View>
      {morphWarning && (
        <View style={{ backgroundColor: c.warn, borderRadius: radius.md, paddingHorizontal: 9, paddingVertical: 6 }}>
          <Txt v="bodySm" color="warnText" bold style={{ fontSize: 12.5 }}>{morphWarning}</Txt>
        </View>
      )}
    </View>
  );
}

/** Estilo de frase sem fonte dentro de uma afirmação (proto: .claim .uncited). */
export function useUncitedStyle(): TextStyle {
  const { c } = useTheme();
  return { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: c.warnText };
}

/** Separador horizontal fino. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.border }, style]} />;
}

export type { PressableProps };

// ---- listas, opções e estados (proto: .group .row .opt .pill .back) ------------------------

/** Grupo de linhas com borda e cantos arredondados (proto: .group). */
export function ListGroup({ children, testID }: { children: ReactNode; testID?: string }) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.card, overflow: 'hidden' }}>
      {children}
    </View>
  );
}

/**
 * Linha de navegação com chevron (proto: .row). `warn` = alerta: fundo e texto de aviso, com ícone
 * (limite, atenção ou sem método). `first` tira a divisória de cima.
 */
export function ListRow({
  title,
  subtitle,
  onPress,
  warn,
  first,
  testID,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  warn?: boolean;
  first?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  const fg = warn ? c.warnText : c.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={warn ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[5],
        minHeight: 60,
        paddingHorizontal: space[7],
        paddingVertical: space[6],
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
        backgroundColor: warn ? c.warn : c.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {warn ? <Icon name="alert" size={20} color={c.warnText} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt v="body" bold tint={fg}>{title}</Txt>
        <Txt v="bodySm" bold={!!warn} tint={warn ? c.warnText : c.muted}>{subtitle}</Txt>
      </View>
      <Icon name="chevronRight" size={18} color={warn ? c.warnText : c.muted} />
    </Pressable>
  );
}

/** Opção de escolha única com bolinha (proto: .opt). `help` aparece abaixo do nome. */
export function RadioOption({
  selected,
  title,
  help,
  mono,
  first,
  onPress,
  testID,
}: {
  selected: boolean;
  title: string;
  help?: string;
  mono?: boolean;
  first?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={help ? `${title}. ${help}` : title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space[5],
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
        backgroundColor: selected ? c.selected : c.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 18,
          height: 18,
          marginTop: 2,
          borderRadius: 9,
          borderWidth: 1.5,
          borderColor: selected ? c.accent : c.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: c.accent }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Txt v="bodySm" bold style={{ fontSize: 14, lineHeight: 19 }}>{title}</Txt>
        {help ? (
          <Txt v="bodySm" color="muted" style={{ fontSize: 12.5, lineHeight: 17, fontFamily: mono ? fontFamilies.mono : undefined }}>
            {help}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Pílula de estado (proto: .pill): ok = verde, warn = âmbar (atenção), muted = neutro. */
export function StatusPill({ label, tone, testID }: { label: string; tone: 'ok' | 'warn' | 'muted'; testID?: string }) {
  const { c } = useTheme();
  const bg = tone === 'ok' ? c.src : tone === 'warn' ? c.warn : c.chip;
  const fg = tone === 'ok' ? c.srcText : tone === 'warn' ? c.warnText : c.muted;
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: bg }}>
      {tone === 'ok' ? <Icon name="check" size={12} color={fg} /> : tone === 'warn' ? <Icon name="alert" size={12} color={fg} /> : null}
      <Txt v="meta" tint={fg} style={{ fontFamily: fontFamilies.uiBold, fontSize: 11.5, lineHeight: 16 }}>{label}</Txt>
    </View>
  );
}

/** Voltar do cabeçalho de uma sub-tela (proto: .back): chevron de 44 px de toque. */
export function HeaderBackButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: size.minTouch, height: size.minTouch, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name="chevronLeft" size={24} color={c.accent} />
    </Pressable>
  );
}
