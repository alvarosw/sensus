// Vertente teológica: "Todas as tradições" (padrão) ou uma ou mais. Grava a mesma preferência de Configurações >
// Interpretação e comentários (regra de alternância em settings/commentary-model.ts).
import { ScrollView } from 'react-native';
import { TRADITIONS, traditionLabel } from '@sensus/core';
import { Card, Txt, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { useLang } from '@/i18n';
import { useAppPrefs } from '@/settings/app-prefs';
import { toggleTradition } from '@/settings/commentary-model';
import { COMMENTARY_STRINGS } from '@/settings/commentary-strings';
import { TraditionChip } from '@/settings/commentary-parts';
import { DATA_COPY } from '@/data/strings';
import { ONBOARDING_COPY } from './strings';

export function StepTraditions({ onNext }: { onNext: () => void }) {
  const { c } = useTheme();
  const lang = useLang();
  const pref = useAppPrefs((s) => s.commentaryPrefs);
  const setPrefs = useAppPrefs((s) => s.setCommentaryPrefs);
  const allOn = pref.traditions === null;

  return (
    <ScrollView testID="onb-tradicoes" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Txt v="bookTitle">{ONBOARDING_COPY.traditionsTitle}</Txt>
      <Txt v="bodySm" color="muted">{ONBOARDING_COPY.traditionsHelp}</Txt>
      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TraditionChip
          testID="onb-trad-all"
          label={COMMENTARY_STRINGS.allTraditions}
          on={allOn}
          onPress={() => setPrefs({ ...pref, traditions: null })}
        />
        {Object.keys(TRADITIONS).map((id) => (
          <TraditionChip
            key={id}
            testID={`onb-trad-${id}`}
            label={traditionLabel(id, lang)}
            on={!allOn && (pref.traditions ?? []).includes(id)}
            onPress={() => setPrefs({ ...pref, traditions: toggleTradition(pref.traditions, id) })}
          />
        ))}
      </Card>
      <Txt v="meta" color="muted">{ONBOARDING_COPY.traditionsNote}</Txt>
      <FormButton testID="onb-next" label={DATA_COPY.continue} onPress={onNext} />
    </ScrollView>
  );
}
