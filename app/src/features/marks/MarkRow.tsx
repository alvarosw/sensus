// Uma linha de Minhas marcas: faixa da cor (ou da nota), referência, texto da Bíblia ativa (2 linhas), nota (3 linhas)
// e o ⋯, que abre as ações (Ir ao trecho, Editar/Adicionar nota, Mudar cor, Apagar).
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatReference, BOOK_TABLE, type VerseRange } from '@sensus/core';
import { HIGHLIGHT_TINTS,  Txt, fontFamilies, radius, useTheme, type HighlightKey } from '@/design';
import { currentLang } from '@/i18n/lang-store';
import { useMarksUi } from './marks-ui';
import { changeColor, deleteMarks } from './actions';
import { MARKS } from './strings';
import { MARK_COLORS, type Mark, type MarkColor } from '@/user-data';
import type { MarkText } from './useMarkRows';

export interface MarkRowProps {
  mark: Mark;
  text: MarkText | undefined;
  bibleName: string;
  onGo(range: VerseRange, missing: boolean): void;
}

export function MarkRow({ mark, text, bibleName, onGo }: MarkRowProps) {
  const { c, scheme } = useTheme();
  const [menu, setMenu] = useState(false);
  const [colors, setColors] = useState(false);
  const openNote = useMarksUi((s) => s.openNote);
  const isNote = mark.note !== null;
  const stripe = isNote ? c.accent : HIGHLIGHT_TINTS[scheme][mark.color as HighlightKey]?.dot ?? c.border;
  const range = text?.range ?? { start: mark.startVid, end: mark.endVid, missing: false };
  const ref = formatReference({ start: range.start, end: range.end }, BOOK_TABLE, currentLang());
  const stored = { start: mark.startVid, end: mark.endVid };

  return (
    <View testID={`mark-${mark.id}`} style={{ flexDirection: 'row', borderRadius: radius.lg, backgroundColor: c.chip, overflow: 'hidden' }}>
      <View style={{ width: 5, backgroundColor: stripe }} />
      <View style={{ flex: 1, minWidth: 0, padding: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={() => onGo(range, range.missing)} style={{ flex: 1, minWidth: 0 }}>
            <Txt v="bodySm" bold style={{ fontFamily: fontFamilies.uiBold }}>{ref}</Txt>
          </Pressable>
          <Pressable testID={`mark-more-${mark.id}`} accessibilityRole="button" accessibilityLabel={MARKS.more} onPress={() => setMenu((m) => !m)} hitSlop={10} style={{ minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="body" color="muted">⋯</Txt>
          </Pressable>
        </View>
        {range.missing ? (
          <Txt v="meta" color="warnText">{MARKS.missingVerse(bibleName)}</Txt>
        ) : (
          <Text numberOfLines={2} style={{ fontFamily: fontFamilies.read, fontSize: 15, lineHeight: 22, color: c.text }}>{text?.text ?? ''}</Text>
        )}
        {isNote && (
          <Text numberOfLines={3} style={{ fontFamily: fontFamilies.ui, fontSize: 14, lineHeight: 20, color: c.muted }}>{mark.note}</Text>
        )}
        {menu && (
          <View testID={`mark-menu-${mark.id}`} style={{ marginTop: 4, gap: 2 }}>
            <MenuItem label={MARKS.goTo} onPress={() => onGo(range, range.missing)} />
            {!isNote && <MenuItem label={MARKS.addNote} onPress={() => openNote(stored.start, stored.end)} />}
            {isNote && <MenuItem label={MARKS.editNote} onPress={() => openNote(stored.start, stored.end)} />}
            {!isNote && <MenuItem label={MARKS.changeColor} onPress={() => setColors((v) => !v)} />}
            {!isNote && colors && (
              <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 6, paddingLeft: 4 }}>
                {MARK_COLORS.map((id) => (
                  <Pressable key={id} accessibilityRole="button" accessibilityLabel={`${MARKS.changeColor}: ${MARKS.colorNames[id]}`} onPress={() => void changeColor(mark, id as MarkColor)} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: HIGHLIGHT_TINTS[scheme][id].dot }} />
                  </Pressable>
                ))}
              </View>
            )}
            <MenuItem label={MARKS.delete} tone="danger" onPress={() => void deleteMarks([mark])} />
          </View>
        )}
      </View>
    </View>
  );
}

function MenuItem({ label, onPress, tone }: { label: string; onPress: () => void; tone?: 'danger' }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 40, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Txt v="button" style={{ color: tone === 'danger' ? c.danger : c.accent, fontFamily: fontFamilies.uiSemibold }}>{label}</Txt>
    </Pressable>
  );
}
