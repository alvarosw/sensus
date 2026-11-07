// Abertura: a candeia sobre o Salmo 119:105 no idioma do app (ver candeia/ e verses.ts).
import { CandeiaScene } from './candeia';
import { appLangInfo } from '@sensus/core';
import { t, useLang } from '@/i18n';
import { ONBOARDING_COPY } from './strings';
import { verseOf } from './verses';

export function StepOpening({ onNext }: { onNext: () => void }) {
  const lang = useLang();
  const { verse, reference } = verseOf(lang);
  return (
    <CandeiaScene
      testID="onb-abertura"
      title={t('app.name')}
      verse={verse}
      reference={reference}
      hint={ONBOARDING_COPY.hint}
      ctaLabel={ONBOARDING_COPY.start}
      onContinue={onNext}
      rtl={appLangInfo(lang).rtl}
    />
  );
}
