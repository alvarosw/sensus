// Barra de ações da seleção (contrato da barra comum, { actions: SelectionAction[] }). Versão mínima desta branch:
// a frente de compartilhar (feat/1a-compartilhar) traz a barra completa e substitui este arquivo no merge.
import { Pressable, View } from 'react-native';
import { Icon, Txt, fontFamilies, radius, useTheme, type IconName } from '@/design';

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
  /** A ação já tem conteúdo na seleção (ex.: uma nota): fundo de destaque leve. */
  filled?: boolean;
}

export function SelectionBar({ actions }: { actions: SelectionAction[] }) {
  const { c } = useTheme();
  return (
    <View testID="selection-bar" style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, paddingVertical: 6 }}>
      {actions.map((a) => (
        <Pressable
          key={a.key}
          testID={`selbar-${a.key}`}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          onPress={a.onPress}
          style={({ pressed }) => ({ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: 8, backgroundColor: a.primary ? c.accent : a.filled ? c.selected : undefined, opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name={a.icon} size={18} color={a.primary ? c.accentText : c.text} />
            {a.dotColor && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: a.dotColor }} />}
          </View>
          <Txt v="meta" style={{ fontFamily: fontFamilies.uiSemibold, color: a.primary ? c.accentText : c.text }}>{a.label}</Txt>
        </Pressable>
      ))}
    </View>
  );
}
