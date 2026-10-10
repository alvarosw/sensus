// Bloco de leitura: parágrafo (versículos em fluxo contínuo) ou título de seção.
import { memo } from 'react';
import { Text, View, type LayoutRectangle } from 'react-native';
import type { Vid } from '@sensus/core';
import { readingFont, useTheme } from '@/ui/theme';
import type { FlowBlock } from './verse-flow';

export const ReadingBlock = memo(function ReadingBlock({
  block,
  selection,
  flash,
  onVersePress,
  onLayout,
}: {
  block: FlowBlock;
  selection: { start: Vid; end: Vid } | null;
  flash: { start: Vid; end: Vid } | null;
  onVersePress: (vid: Vid) => void;
  onLayout: (key: string, layout: LayoutRectangle) => void;
}) {
  const theme = useTheme();
  return (
    <View onLayout={(e) => onLayout(block.key, e.nativeEvent.layout)}>
      {block.kind === 'heading' ? (
        <Text
          accessibilityRole="header"
          style={{
            color: theme.accent,
            fontFamily: readingFont,
            fontSize: 17,
            fontWeight: '700',
            lineHeight: 24,
            marginTop: 22,
            marginBottom: 6,
          }}
        >
          {block.title}
        </Text>
      ) : (
        <Text
          style={{
            color: theme.text,
            fontFamily: readingFont,
            fontSize: 18,
            lineHeight: 31,
            marginBottom: 16,
          }}
        >
          {block.verses.map((v) => {
            const selected = selection !== null && v.vid >= selection.start && v.vid <= selection.end;
            const flashed = !selected && flash !== null && v.vid >= flash.start && v.vid <= flash.end;
            const bg = selected ? theme.selected : flashed ? theme.highlight : undefined;
            return (
              <Text key={v.cite_id} onPress={() => onVersePress(v.vid)} style={bg ? { backgroundColor: bg } : undefined}>
                <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '700' }}>{v.vid % 1000}</Text>
                {' '}
                {v.text}
                {' '}
              </Text>
            );
          })}
        </Text>
      )}
    </View>
  );
});
