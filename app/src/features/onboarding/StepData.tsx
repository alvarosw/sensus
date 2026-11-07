// Dados de estudo: a mesma oferta da tela data-setup (StudyDataOffer). "Depois" grava a versão recusada e avança.
import { ScrollView } from 'react-native';
import { useTheme } from '@/design';
import { StudyDataOffer } from '@/data/StudyDataOffer';
import { useDataStore } from '@/data/data-store';
import { ONBOARDING_COPY } from './strings';

export function StepData({ onNext }: { onNext: () => void }) {
  const { c } = useTheme();
  const deferOffer = useDataStore((s) => s.deferOffer);
  return (
    <ScrollView testID="onb-dados" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 20 }}>
      <StudyDataOffer
        onLater={() => {
          deferOffer();
          onNext();
        }}
        onDone={onNext}
        background={{ label: ONBOARDING_COPY.dataContinueBackground, onPress: onNext }}
      />
    </ScrollView>
  );
}
