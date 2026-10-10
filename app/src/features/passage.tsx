import { useState } from 'react';
import { Text, View } from 'react-native';
import { splitVid, type PanelData } from '@sensus/core';
import { t } from '@/i18n';
import { Card, Chip, Heading } from '@/ui/primitives';
import { Meta } from '@/ui/text';
import { readingFont, useTheme } from '@/ui/theme';
import { useSheets } from './sheets';

const PRIMARY_TEXT = 'blivre';

/** Trecho em português com a opção de mostrar o grego (TR) palavra a palavra, tocável. */
export function PassageCard({ panel, reference }: { panel: PanelData; reference: string }) {
  const theme = useTheme();
  const sheets = useSheets();
  const [greek, setGreek] = useState(false);

  const translations = panel.layers.text.translations;
  const sourceId = translations.some((v) => v.source_id === PRIMARY_TEXT)
    ? PRIMARY_TEXT
    : translations[0]?.source_id;
  const verses = translations.filter((v) => v.source_id === sourceId);

  const wordsByVid = new Map<number, typeof panel.layers.text.original>();
  for (const tok of panel.layers.text.original) {
    const list = wordsByVid.get(tok.vid) ?? [];
    list.push(tok);
    wordsByVid.set(tok.vid, list);
  }

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Meta>{t('study.passage')}</Meta>
          <Heading level={1}>{reference}</Heading>
        </View>
        <Chip label={t('study.showGreek')} selected={greek} onPress={() => setGreek((v) => !v)} />
      </View>

      {verses.length === 0 ? <Meta>{t('common.unavailable')}</Meta> : null}
      {verses.map((v) => {
        const p = splitVid(v.vid);
        const words = wordsByVid.get(v.vid) ?? [];
        return (
          <View key={v.cite_id} style={{ gap: 6 }}>
            <Text style={{ color: theme.text, fontSize: 17, lineHeight: 27, fontFamily: readingFont }}>
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>{`${p.chapter}:${p.verse}  `}</Text>
              {v.text}
            </Text>
            {greek && words.length > 0 ? (
              <Text style={{ color: theme.textMuted, fontSize: 16, lineHeight: 25, fontFamily: readingFont }}>
                {words.map((tok, i) => (
                  <Text
                    key={tok.cite_id}
                    accessibilityRole="button"
                    onPress={() => sheets.openToken(tok.cite_id)}
                    style={{ textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: theme.accent }}
                  >
                    {tok.surface}
                    {i < words.length - 1 ? ' ' : ''}
                  </Text>
                ))}
              </Text>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}
