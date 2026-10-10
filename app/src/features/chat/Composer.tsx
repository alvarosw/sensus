// Rodapé do chat: anexos (chips removíveis), campo da pergunta e botão enviar/parar.
import { forwardRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { fontFamilies, Icon, radius, size, Txt, useTheme } from '@/design';
import { useStudy } from '@/state/study';
import { GreekText } from '../common/GreekText';
import { CHAT } from '../common/strings';

export const Composer = forwardRef<
  TextInput,
  {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    onStop: () => void;
    streaming: boolean;
    disabled: boolean;
    bottomPad: number;
  }
>(function Composer({ value, onChange, onSend, onStop, streaming, disabled, bottomPad }, ref) {
  const { c } = useTheme();
  const attachments = useStudy((s) => s.attachments);
  const detach = useStudy((s) => s.detach);
  const canSend = !disabled && value.trim().length > 0;
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: c.border,
        paddingTop: 8,
        paddingHorizontal: 10,
        paddingBottom: bottomPad,
        backgroundColor: c.surface,
        gap: 6,
      }}
    >
      {attachments.length > 0 ? (
        <View testID="attached" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
          {attachments.map((a) => (
            <View
              key={a.id}
              testID={`attached-${a.id}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.chip, borderRadius: radius.md, paddingLeft: 8, paddingRight: 4, paddingVertical: 2 }}
            >
              <GreekText v="meta" style={{ fontSize: 12 }} numberOfLines={1}>{a.label}</GreekText>
              <Pressable
                testID={`detach-${a.id}`}
                accessibilityRole="button"
                accessibilityLabel={CHAT.remove}
                hitSlop={8}
                onPress={() => detach(a.id)}
                style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="close" size={9} color={c.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput
          ref={ref}
          testID="composer-input"
          accessibilityLabel="Pergunta"
          value={value}
          onChangeText={onChange}
          onSubmitEditing={() => canSend && onSend()}
          returnKeyType="send"
          placeholder={attachments.length > 0 ? CHAT.placeholderAttached : CHAT.placeholder}
          placeholderTextColor={c.muted}
          autoCorrect
          style={{
            flex: 1,
            minWidth: 0,
            height: size.input,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.bg,
            borderRadius: radius.xl,
            paddingHorizontal: 12,
            fontFamily: fontFamilies.ui,
            fontSize: 14,
            color: c.text,
            outlineColor: c.accent,
          }}
        />
        <Pressable
          testID="composer-send"
          accessibilityRole="button"
          accessibilityLabel={streaming ? CHAT.stop : CHAT.send}
          accessibilityState={{ disabled: !streaming && !canSend }}
          onPress={streaming ? onStop : canSend ? onSend : undefined}
          style={({ pressed }) => ({
            width: 44,
            height: size.input,
            borderRadius: radius.xl,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled && !streaming ? 0.5 : pressed ? 0.7 : 1,
          })}
        >
          {streaming ? (
            <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: c.accentText }} />
          ) : (
            <Icon name="send" size={16} color={c.accentText} />
          )}
        </Pressable>
      </View>
    </View>
  );
});
