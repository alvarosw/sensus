// Cartão da folha de estudo quando o banco ativo é o de leitura: convida a baixar os dados de estudo.
// O texto bíblico continua disponível; só os painéis de estudo (comentários, léxico, etc.) esperam o download.
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, gutter, IconButton, shadow, Txt, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { useDataStore } from './data-store';
import { DownloadStatus } from './DownloadStatus';
import { formatMB } from './plan';
import { DATA_COPY } from './strings';

export function StudyDataPrompt({ onClose }: { onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const manifest = useDataStore((s) => s.manifest);
  const phase = useDataStore((s) => s.machine.phase);
  const start = useDataStore((s) => s.start);
  const size = manifest ? formatMB(manifest.full.size) : DATA_COPY.sizeUnknown;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', left: gutter.sheet, right: gutter.sheet, bottom: insets.bottom + 16 }}>
        <Card testID="study-data-card" style={[{ paddingVertical: 14, paddingHorizontal: 16, gap: 10, backgroundColor: c.surface }, shadow.pop]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt v="lensTitle">{DATA_COPY.studyTitle}</Txt>
              <Txt v="bodySm" color="muted">{DATA_COPY.studyBody(size)}</Txt>
            </View>
            <IconButton testID="study-data-close" icon="close" label={DATA_COPY.studyNotNow} onPress={onClose} />
          </View>
          {phase === 'idle' ? (
            <FormButton testID="study-data-download" label={DATA_COPY.download} onPress={start} />
          ) : (
            <DownloadStatus testID="study-data-status" />
          )}
        </Card>
      </View>
    </View>
  );
}
