// Barra de ações da seleção, no fim do "espiar" (docs/design/1a-copiar-compartilhar.html): Estudar · Grifar · Nota ·
// Copiar · Compartilhar. Comum às frentes da 1A: cada uma passa as suas ações; a barra só desenha.
// Cada botão ocupa a largura do próprio rótulo (a principal ganha um pouco mais), para "Compartilhar" caber inteiro
// a partir de 320 px. Ícone e rótulo sempre visíveis; toque mínimo de 44 px.
import { Pressable, View } from 'react-native';
import { Icon, Txt, radius, size, space, useTheme, type IconName } from '@/design';

export interface SelectionAction {
  /** Chave estável (vira o testID `selbar-<key>`). */
  key: string;
  label: string;
  icon: IconName;
  onPress(): void;
  /** Ação principal (Estudar): fundo na cor de destaque. */
  primary?: boolean;
  /** Ponto de cor junto ao ícone (ex.: a cor do grifo que a seleção já tem). */
  dotColor?: string;
  /** A ação já tem conteúdo na seleção (ex.: uma nota): o botão fica com fundo de destaque leve. */
  filled?: boolean;
}

const BAR_HEIGHT = 56;
const ICON = 21;
const DOT = 9;

export function SelectionBar({ actions }: { actions: SelectionAction[] }) {
  const { c } = useTheme();
  if (actions.length === 0) return null;
  return (
    <View
      testID="selbar"
      accessibilityRole="toolbar"
      style={{
        flexDirection: 'row',
        gap: space[2],
        paddingHorizontal: space[6],
        paddingTop: space[5],
        paddingBottom: space[7],
        borderTopWidth: 1,
        borderTopColor: c.border,
      }}
    >
      {actions.map((a) => {
        const fg = a.primary ? c.accentText : c.text;
        return (
          <Pressable
            key={a.key}
            testID={`selbar-${a.key}`}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityState={a.filled ? { selected: true } : undefined}
            onPress={a.onPress}
            style={({ pressed }) => ({
              flexGrow: a.primary ? 1.35 : 1,
              flexShrink: 1,
              minWidth: size.minTouch,
              height: BAR_HEIGHT,
              paddingHorizontal: space[1],
              borderRadius: radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space[2],
              backgroundColor: a.primary ? c.accent : a.filled || pressed ? c.chip : 'transparent',
              opacity: pressed && a.primary ? 0.8 : 1,
            })}
          >
            <View>
              <Icon name={a.icon} size={ICON} color={a.primary ? c.accentText : c.accent} />
              {a.dotColor ? (
                <View
                  testID={`selbar-${a.key}-dot`}
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -5,
                    width: DOT,
                    height: DOT,
                    borderRadius: DOT / 2,
                    backgroundColor: a.dotColor,
                    borderWidth: 1.5,
                    borderColor: c.surface,
                  }}
                />
              ) : null}
            </View>
            <Txt v="button" tint={fg} numberOfLines={1} style={{ fontSize: 11.5, lineHeight: 14 }}>
              {a.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
