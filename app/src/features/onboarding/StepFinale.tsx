// Fim: a luz se espalha e a apresentação termina (o movimento concluir fica com o fluxo).
import { CandeiaFinale } from './candeia';
import { appLangInfo } from '@sensus/core';
import { useLang } from '@/i18n';
import { ONBOARDING_COPY } from './strings';
import { verseOf } from './verses';

export function StepFinale({ onDone }: { onDone: () => void }) {
  const lang = useLang();
  const { verse, reference } = verseOf(lang);
  return (
    <CandeiaFinale
      testID="onb-fim"
      verse={verse}
      reference={reference}
      ctaLabel={ONBOARDING_COPY.finale}
      onDone={onDone}
      rtl={appLangInfo(lang).rtl}
    />
  );
}
