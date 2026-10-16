// Em paralelo (?linha=<cite_id> abre só com esta linha; sem o parâmetro, com as favoritas).
import { useLocalSearchParams } from 'expo-router';
import { ParallelView } from '@/features/timeline/ParallelView';

export default function TimelineParallel() {
  const { linha } = useLocalSearchParams<{ linha?: string }>();
  return <ParallelView lineId={typeof linha === 'string' && linha ? linha : undefined} />;
}
