// Barra de ações da seleção com a paleta de grifo no mesmo lugar: Grifar troca a barra pela paleta (protótipo da
// Trilha A). Usada no "espiar" e no convite de dados de estudo (banco de leitura), para que grifar, anotar, copiar e
// compartilhar funcionem também sem os dados de estudo.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { gutter } from '@/design';
import { SelectionBar } from '@/features/common/SelectionBar';
import { HighlightPalette } from '@/features/marks';
import type { Vid } from '@sensus/core';
import { useSelectionActions } from './useSelectionActions';

export function SelectionActions({ range, study }: { range: { start: Vid; end: Vid }; study: boolean }) {
  const [palette, setPalette] = useState(false);
  const actions = useSelectionActions(range, { study, onHighlight: () => setPalette(true) });
  // Nova seleção: volta à barra.
  useEffect(() => setPalette(false), [range.start, range.end]);
  if (!palette) return <SelectionBar actions={actions} />;
  return (
    <View style={{ paddingHorizontal: gutter.sheet, paddingBottom: 10 }}>
      <HighlightPalette start={range.start} end={range.end} onDone={() => setPalette(false)} />
    </View>
  );
}
