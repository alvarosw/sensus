// Folha da nota: sobe sobre o leitor, com o texto visível acima. Leitura com Editar e Apagar; editor com Salvar.
// Texto vazio ao salvar apaga a nota (com Desfazer). Voltar do sistema e toque fora fecham.
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { formatReference, BOOK_TABLE } from '@sensus/core';
import { fontFamilies, gutter, radius, shadow, Txt, useTheme } from '@/design';
import { currentLang } from '@/i18n/lang-store';
import { useMarksStore, noteOn } from '@/user-data';
import { BACK_PRIORITY, useBackLayer } from '../common/back';
import { deleteMarks, saveNote } from './actions';
import { MARKS } from './strings';
import { useMarksUi } from './marks-ui';

export function NoteSheet() {
  const note = useMarksUi((s) => s.note);
  const closeNote = useMarksUi((s) => s.closeNote);
  const setEditing = useMarksUi((s) => s.setEditing);
  const existing = useMarksStore((s) => (note ? noteOn(s.marks.filter((m) => m.note !== null), note.start, note.end) : null));
  useBackLayer('note', note !== null, closeNote, BACK_PRIORITY.popover);
  if (!note) return null;
  return <NoteBody key={`${note.start}-${note.end}-${note.editing ? 'e' : 'v'}`} start={note.start} end={note.end} editing={note.editing} existingText={existing?.note ?? null} existingId={existing?.id ?? null} onEdit={() => setEditing(true)} onClose={closeNote} />;
}

function NoteBody({ start, end, editing, existingText, existingId, onEdit, onClose }: { start: number; end: number; editing: boolean; existingText: string | null; existingId: number | null; onEdit: () => void; onClose: () => void }) {
  const { c } = useTheme();
  const [draft, setDraft] = useState(existingText ?? '');
  const title = MARKS.noteTitle(formatReference({ start, end }, BOOK_TABLE, currentLang()));
  const existing = useMarksStore.getState().marks.find((m) => m.id === existingId) ?? null;

  const save = () => {
    onClose();
    void saveNote(start, end, draft, existing ?? undefined);
  };
  const del = () => {
    onClose();
    if (existing) void deleteMarks([existing], MARKS.noteDeleted);
  };

  useEffect(() => {
    setDraft(existingText ?? '');
  }, [existingText]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' }}>
      <Pressable accessibilityLabel={MARKS.close} onPress={onClose} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.scrim }} />
      <View testID="note-sheet" style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: gutter.sheet, paddingBottom: 26, maxHeight: '70%', gap: 12, ...shadow.sheet }}>
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.border }} />
        <Txt v="body" bold style={{ fontFamily: fontFamilies.uiBold }}>{title}</Txt>
        {editing ? (
          <>
            <TextInput
              testID="note-input"
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              placeholder={MARKS.notePlaceholder}
              placeholderTextColor={c.muted}
              style={{ minHeight: 110, maxHeight: 260, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: 12, color: c.text, backgroundColor: c.bg, fontFamily: fontFamilies.read, fontSize: 16, lineHeight: 24, textAlignVertical: 'top' }}
            />
            <Txt v="meta" color="muted">{MARKS.noteEmptyHint}</Txt>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <Pressable testID="note-cancel" accessibilityRole="button" onPress={onClose} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}>
                <Txt v="button" color="muted">{MARKS.close}</Txt>
              </Pressable>
              <Pressable testID="note-save" accessibilityRole="button" onPress={save} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 18, borderRadius: radius.md, justifyContent: 'center', backgroundColor: c.accent, opacity: pressed ? 0.7 : 1 })}>
                <Txt v="button" style={{ color: c.accentText, fontFamily: fontFamilies.uiSemibold }}>{MARKS.save}</Txt>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <ScrollView style={{ maxHeight: 260 }}>
              <Txt v="body" style={{ fontFamily: fontFamilies.read, lineHeight: 24 }}>{existingText ?? ''}</Txt>
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <Pressable testID="note-delete" accessibilityRole="button" onPress={del} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}>
                <Txt v="button" style={{ color: c.danger, fontFamily: fontFamilies.uiSemibold }}>{MARKS.delete}</Txt>
              </Pressable>
              <Pressable testID="note-edit" accessibilityRole="button" onPress={onEdit} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 18, borderRadius: radius.md, justifyContent: 'center', backgroundColor: c.accent, opacity: pressed ? 0.7 : 1 })}>
                <Txt v="button" style={{ color: c.accentText, fontFamily: fontFamilies.uiSemibold }}>{MARKS.edit}</Txt>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
