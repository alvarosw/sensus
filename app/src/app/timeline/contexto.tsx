// Cronologia do trecho (?de=&ate= são os versículos do trecho; ?escopo=book|bible). Abre a partir de
// "Abrir na linha do tempo" da lente Histórico e da pílula "Voltar à linha do tempo" do leitor.
import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ContextView } from '@/features/timeline/ContextView';
import { spanFromParams } from '@/features/timeline/context-model';

export default function TimelineContext() {
  const { de, ate, escopo } = useLocalSearchParams<{ de?: string; ate?: string; escopo?: string }>();
  const span = useMemo(() => spanFromParams(de, ate), [de, ate]);
  return <ContextView span={span} initialScope={escopo === 'bible' ? 'bible' : 'book'} />;
}
