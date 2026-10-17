// Folha "★ Salvar combinação": guarda as linhas da tela como favorita. O nome é editável; sem nome, usa os nomes das
// linhas (o padrão já vem preenchido).
import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { Txt, radius, size, space, useTheme, fontFamilies } from '@/design';
import { TL } from './strings';

export function SaveComboSheet({ defaultName, onSave, onClose }: { defaultName: string; onSave: (name: string) => void; onClose: () => void }) {
  const { c } = useTheme();
  const [name, setName] = useState(defaultName);
  const save = () => onSave(name.trim() || defaultName);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={TL.cancel} onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.scrim }} />
        <View
          testID="tl-save-sheet"
          accessibilityViewIsModal
          style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space[4], paddingBottom: space[8], paddingHorizontal: space[8], gap: space[5] }}
        >
          <View style={{ alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: c.border }} />
          <Txt v="sheetTitle" accessibilityRole="header">{TL.saveTitle}</Txt>
          <View style={{ gap: space[3] }}>
            <Txt v="eyebrow" color="muted">{TL.saveName}</Txt>
            <TextInput
              testID="tl-save-name"
              value={name}
              onChangeText={setName}
              onSubmitEditing={save}
              returnKeyType="done"
              accessibilityLabel={TL.saveName}
              style={{ minHeight: size.minTouch, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, paddingHorizontal: space[5], color: c.text, fontFamily: fontFamilies.uiSemibold, fontSize: 15 }}
            />
            <Txt v="meta" color="muted">{TL.saveNameHint}</Txt>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space[3] }}>
            <Pressable testID="tl-save-cancel" accessibilityRole="button" onPress={onClose} style={{ minHeight: size.minTouch, justifyContent: 'center', paddingHorizontal: space[5] }}>
              <Txt v="button" tint={c.muted}>{TL.cancel}</Txt>
            </Pressable>
            <Pressable
              testID="tl-save-confirm"
              accessibilityRole="button"
              onPress={save}
              style={({ pressed }) => ({ minHeight: size.minTouch, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: c.accent, paddingHorizontal: space[6], opacity: pressed ? 0.8 : 1 })}
            >
              <Txt v="button" tint={c.accentText}>{TL.saveAction}</Txt>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
