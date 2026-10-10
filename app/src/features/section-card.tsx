import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SECTION_LABELS, SECTION_LAYER, type Block, type Book, type CiteIndex, type PanelData, type SectionKey } from '@sensus/core';
import { t } from '@/i18n';
import { Button, Card, Heading } from '@/ui/primitives';
import { Skeleton } from '@/ui/skeleton';
import { Meta } from '@/ui/text';
import { RichText } from './rich-text';
import { LayerContent } from './panel-sections';

interface Props {
  sectionKey: SectionKey;
  /** Blocos já recebidos do resumo; undefined enquanto a seção não chegou. */
  blocks: Block[] | undefined;
  /** O resumo ainda está sendo gerado. */
  streaming: boolean;
  index: CiteIndex | undefined;
  panel: PanelData;
  books: Book[];
  start: number;
  end: number;
}

/** Cartão de seção do resumo: texto curto, fontes sob demanda e aprofundamento. */
export function SectionCard({ sectionKey, blocks, streaming, index, panel, books, start, end }: Props) {
  const [showSources, setShowSources] = useState(false);
  const layer = SECTION_LAYER[sectionKey];

  return (
    <Card style={{ gap: 12 }}>
      <Heading level={3}>{SECTION_LABELS[sectionKey]}</Heading>

      {blocks ? (
        blocks.length > 0 ? (
          <RichText blocks={blocks} index={index} />
        ) : (
          <Meta>{t('study.sectionEmpty')}</Meta>
        )
      ) : streaming ? (
        <Skeleton lines={3} />
      ) : (
        <Meta>{t('study.sectionEmpty')}</Meta>
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {layer ? (
          <View style={{ flex: 1 }}>
            <Button
              label={showSources ? t('study.hideSources') : t('study.viewSources')}
              variant="secondary"
              onPress={() => setShowSources((v) => !v)}
            />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button
            label={t('study.deepen')}
            onPress={() =>
              router.push({
                pathname: '/study/section',
                params: { key: sectionKey, start: String(start), end: String(end) },
              })
            }
          />
        </View>
      </View>

      {layer && showSources ? (
        <View style={{ borderTopWidth: 1, borderTopColor: 'transparent', paddingTop: 4 }}>
          <LayerContent layer={layer} panel={panel} books={books} />
        </View>
      ) : null}
    </Card>
  );
}
