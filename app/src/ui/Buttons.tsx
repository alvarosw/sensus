import { Pressable } from 'react-native';
import { fontFamilies, radius, Txt, useTheme } from '@/design';

/** Botão de ação do popover (proto: .pop-actions button / .primary). */
export function PopButton({
  label,
  onPress,
  primary,
  testID,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        backgroundColor: primary ? c.accent : c.surfaceAlt,
        borderRadius: radius.lg,
        paddingHorizontal: 11,
        paddingVertical: 7,
        minHeight: 32,
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt v="button" color={primary ? 'accentText' : 'text'} style={{ fontFamily: fontFamilies.uiBold }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Botão cheio de formulário (configurações): altura de campo, cor de destaque. */
export function FormButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 44,
        borderRadius: radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? c.accent : variant === 'secondary' ? c.chip : 'transparent',
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <Txt v="bodySm" bold color={primary ? 'accentText' : variant === 'ghost' ? 'danger' : 'text'}>
        {label}
      </Txt>
    </Pressable>
  );
}
