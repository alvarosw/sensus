// Prévia de citação (popover) + painéis empilhados, por cima do leitor, da folha e do chat.
import { StyleSheet, View } from 'react-native';
import { PanelStack } from './PanelStack';
import { SourcePopover } from './SourcePopover';

export function SourceLayer() {
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 13 }]}>
      <SourcePopover />
      <PanelStack />
    </View>
  );
}
