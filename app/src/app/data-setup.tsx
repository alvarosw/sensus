// Primeira vez (e atualizações): oferece baixar os dados de estudo. "Depois" segue lendo com o banco de leitura
// e não repete a oferta para esta versão. Aberta pela tela principal (ver DataSetupGate em _layout.tsx).
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { useDataStore } from '@/data/data-store';
import { StudyDataOffer } from '@/data/StudyDataOffer';

export default function DataSetupScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const deferOffer = useDataStore((s) => s.deferOffer);

  const later = () => {
    deferOffer();
    router.back();
  };

  return (
    <ScrollView
      testID="screen-data-setup"
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }}
    >
      <StudyDataOffer onLater={later} onDone={() => router.back()} />
    </ScrollView>
  );
}
