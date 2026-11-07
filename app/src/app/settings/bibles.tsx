// Configurações > Bíblias: a lista de Bíblias (data/bibles/BiblePicker) para baixar, remover e escolher a principal,
// com o aviso de catálogo desatualizado e o botão de atualizar a lista. Nenhuma Bíblia vem com o app; a única baixada
// não sai (ver canRemoveBible).
import { useEffect } from 'react';
import { ScrollView } from 'react-native';
import { Txt, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { useAppPrefs } from '@/settings/app-prefs';
import { BiblePicker } from '@/data/bibles/BiblePicker';
import { useBibles } from '@/data/bibles/bibles-store';
import { bibleUiLang } from '@/data/bibles/ui-lang';
import { BIBLE_COPY } from '@/data/bibles/strings';

export default function BiblesScreen() {
  const { c } = useTheme();
  const lang = bibleUiLang();
  const catalog = useBibles((s) => s.catalog);
  const catalogError = useBibles((s) => s.catalogError);
  const checking = useBibles((s) => s.checking);
  const refreshCatalog = useBibles((s) => s.refreshCatalog);
  const principal = useAppPrefs((s) => s.textSource);
  const setTextSource = useAppPrefs((s) => s.setTextSource);

  useEffect(() => {
    void refreshCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView testID="settings-bibles" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 22 }} contentInsetAdjustmentBehavior="automatic">
      {catalogError ? <Txt v="bodySm" tint={c.danger} testID="bibles-error">{BIBLE_COPY.catalogError}</Txt> : null}
      {catalog && catalogError ? <Txt v="bodySm" color="muted">{BIBLE_COPY.catalogCached}</Txt> : null}

      <BiblePicker lang={lang} principal={principal} onSelect={setTextSource} />

      {catalog && catalog.bibles.length === 0 ? <Txt v="bodySm" color="muted">{BIBLE_COPY.catalogEmpty}</Txt> : null}

      <FormButton
        testID="bibles-refresh"
        variant="secondary"
        label={checking ? BIBLE_COPY.checking : BIBLE_COPY.refresh}
        disabled={checking}
        onPress={() => void refreshCatalog()}
      />
    </ScrollView>
  );
}
