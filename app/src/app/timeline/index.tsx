// Linha do tempo (tela inicial). ?evento=<cite_id> abre a prévia desse evento (atalho "Abrir na linha do tempo").
import { useLocalSearchParams } from 'expo-router';
import { TimelineHome } from '@/features/timeline/HomeView';

export default function TimelineIndex() {
  const { evento } = useLocalSearchParams<{ evento?: string }>();
  return <TimelineHome eventId={typeof evento === 'string' && evento ? evento : undefined} />;
}
