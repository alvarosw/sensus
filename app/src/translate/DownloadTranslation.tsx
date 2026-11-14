// Botão "Baixar tradução" de um bloco com texto traduzível e a tradução desligada. Fica depois de "Agora não" e
// some quando a oferta está no mesmo bloco. Toque liga a tradução (baixa o modelo se faltar); falha mantém o botão.
import { ActivityIndicator, View } from 'react-native';
import { ActButton, Txt, space, useTheme } from '@/design';
import { isDownloadShown } from './policy';
import { useTranslate } from './store';
import { TR } from './strings';

export function DownloadTranslation({ tr, testID }: { tr: { eligible: boolean; offer: boolean }; testID?: string }) {
  const { c } = useTheme();
  const loaded = useTranslate((s) => s.loaded);
  const enabled = useTranslate((s) => s.enabled);
  const model = useTranslate((s) => s.model);
  const setEnabled = useTranslate((s) => s.setEnabled);

  if (!isDownloadShown({ eligible: tr.eligible, loaded, enabled, offer: tr.offer })) return null;

  if (model === 'downloading') {
    return (
      <View testID={testID ? `${testID}-loading` : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 }}>
        <ActivityIndicator size="small" color={c.muted} />
        <Txt v="meta" color="muted" style={{ fontSize: 12 }}>{TR.modelDownloading}</Txt>
      </View>
    );
  }

  return (
    <View testID={testID} style={{ gap: space[2], paddingTop: 2 }}>
      <ActButton
        label={`${TR.downloadButton} (${TR.modelSize})`}
        onPress={() => void setEnabled(true)}
        testID={testID ? `${testID}-btn` : undefined}
      />
      <Txt v="meta" color="muted" style={{ fontSize: 12, lineHeight: 17 }}>{TR.downloadHint}</Txt>
      {model === 'error' ? (
        <Txt v="meta" color="danger" style={{ fontSize: 12, lineHeight: 17 }} testID={testID ? `${testID}-error` : undefined}>
          {TR.downloadFailed}
        </Txt>
      ) : null}
    </View>
  );
}
