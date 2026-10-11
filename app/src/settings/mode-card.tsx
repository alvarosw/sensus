// "Como a IA responde": três modos (Automático, Só ChatGPT, Só chave de API) e a linha "Em uso agora",
// que diz qual caminho responde neste momento (derivado do provedor efetivo, em ai-status.ts).
import { View } from 'react-native';
import { ListGroup, RadioOption, Txt, useTheme } from '@/design';
import type { ProviderMode } from './route';
import { useSettings } from './settings-context';
import { inUseLine } from './ai-status';
import { useAiSnapshot } from './use-ai-snapshot';
import { SETTINGS_COPY as COPY } from './strings';

const ORDER: ProviderMode[] = ['auto', 'chatgpt', 'key'];

export function ModeCard() {
  const { c } = useTheme();
  const { mode, setMode } = useSettings();
  const use = inUseLine(useAiSnapshot());
  return (
    <ListGroup testID="provider-mode">
      {ORDER.map((id, i) => (
        <RadioOption
          key={id}
          testID={`provider-mode-${id}`}
          first={i === 0}
          selected={mode === id}
          title={COPY.modes[id].name}
          help={COPY.modes[id].help}
          onPress={() => setMode(id)}
        />
      ))}
      <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 12, paddingVertical: 10 }}>
        <Txt v="bodySm" testID="provider-in-use">
          <Txt v="bodySm" bold tint={c.accent}>{COPY.inUse}</Txt>
          {': '}
          <Txt v="bodySm" bold>{use.lead}</Txt>
          {use.rest ? ` ${use.rest}` : ''}
        </Txt>
      </View>
    </ListGroup>
  );
}
