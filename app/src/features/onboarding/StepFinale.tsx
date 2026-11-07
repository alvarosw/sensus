// Fim: a luz se espalha, a apresentação se dá por concluída e convida a começar a estudar (o movimento concluir fica
// com o fluxo). O versículo fica só na abertura.
import { CandeiaFinale } from './candeia';
import { appLangInfo } from '@sensus/core';
import { useLang } from '@/i18n';
import { ONBOARDING_COPY } from './strings';

export function StepFinale({ onDone }: { onDone: () => void }) {
  const lang = useLang();
  return (
    <CandeiaFinale
      testID="onb-fim"
      title={ONBOARDING_COPY.finaleTitle}
      body={ONBOARDING_COPY.finaleBody}
      ctaLabel={ONBOARDING_COPY.finale}
      onDone={onDone}
      rtl={appLangInfo(lang).rtl}
    />
  );
}
