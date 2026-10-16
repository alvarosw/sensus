// Em paralelo (?linha=<cite_id> abre com zoom nesta linha; ?preset=bible|patriarchs|kings|nt escolhe o atalho).
import { useLocalSearchParams } from 'expo-router';
import { ParallelView } from '@/features/timeline/ParallelView';

export default function TimelineParallel() {
  const { linha, preset } = useLocalSearchParams<{ linha?: string; preset?: string }>();
  return <ParallelView lineId={typeof linha === 'string' && linha ? linha : undefined} preset={typeof preset === 'string' ? preset : undefined} />;
}
