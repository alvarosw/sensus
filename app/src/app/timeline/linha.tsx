// Lista de uma linha do tempo (?id=<cite_id da pessoa, lugar ou período>).
import { useLocalSearchParams } from 'expo-router';
import { LineList } from '@/features/timeline/LineView';

export default function TimelineLine() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <LineList lineId={typeof id === 'string' ? id : ''} />;
}
