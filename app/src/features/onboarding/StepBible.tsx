// Bíblia: a recomendada do idioma do app (card, com "Baixar agora" e progresso) e as demais do idioma, em lista curta.
// BLivre e KJV já vêm no app. Continuar ou Depois seguem sem baixar nada.
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { recommendBibles, type BibleEntry } from '@sensus/core';
import { ListGroup, Txt, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { useLang } from '@/i18n';
import { BibleRow } from '@/data/bibles/BibleRow';
import { useBibles } from '@/data/bibles/bibles-store';
import { bibleHasUpdate, bibleRowInfo } from '@/data/bibles/bible-model';
import { IDLE_STATE } from '@/data/download-machine';
import { DATA_COPY } from '@/data/strings';
import { ONBOARDING_COPY } from './strings';

const OTHERS_SHOWN = 3;

export function StepBible({ onNext }: { onNext: () => void }) {
  const { c } = useTheme();
  const lang = useLang();
  const catalog = useBibles((s) => s.catalog);
  const catalogError = useBibles((s) => s.catalogError);
  const installed = useBibles((s) => s.installed);
  const machines = useBibles((s) => s.machines);
  const versions = useBibles((s) => s.versions);
  const refreshCatalog = useBibles((s) => s.refreshCatalog);
  const install = useBibles((s) => s.install);
  const cancel = useBibles((s) => s.cancel);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const rec = catalog ? recommendBibles(catalog, lang) : null;
  const top: BibleEntry | null = rec?.recommended[0] ?? null;
  const others = rec?.recommended.slice(1, 1 + OTHERS_SHOWN) ?? [];
  const topReady = top !== null && installed.includes(top.id);

  const rowFor = (entry: BibleEntry, first: boolean, badge: boolean) => (
    <BibleRow
      key={entry.id}
      info={bibleRowInfo(entry.id, catalog)}
      installed={installed.includes(entry.id)}
      update={bibleHasUpdate(entry, versions[entry.id])}
      updateVersion={entry.version}
      badge={badge}
      first={first}
      machine={machines[entry.id] ?? IDLE_STATE}
      onInstall={() => install(entry.id)}
      onCancel={() => cancel(entry.id)}
    />
  );

  return (
    <ScrollView testID="onb-biblia" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Txt v="bookTitle">{ONBOARDING_COPY.bibleTitle}</Txt>
      <Txt v="bodySm" color="muted">{ONBOARDING_COPY.bibleHelp}</Txt>

      {!catalog && catalogError ? <Txt v="bodySm" color="muted" testID="onb-biblia-offline">{ONBOARDING_COPY.bibleOffline}</Txt> : null}
      {catalog && !top ? <Txt v="bodySm" color="muted" testID="onb-biblia-none">{ONBOARDING_COPY.bibleNone}</Txt> : null}

      {top ? (
        <View style={{ gap: 8 }}>
          <Txt v="eyebrow" color="muted" style={{ paddingLeft: 2 }}>{ONBOARDING_COPY.bibleRecommended}</Txt>
          <ListGroup testID="onb-biblia-top">{rowFor(top, true, true)}</ListGroup>
        </View>
      ) : null}

      {others.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Txt v="eyebrow" color="muted" style={{ paddingLeft: 2 }}>{ONBOARDING_COPY.bibleOthers}</Txt>
          <ListGroup testID="onb-biblia-others">{others.map((entry, i) => rowFor(entry, i === 0, false))}</ListGroup>
        </View>
      ) : null}

      <FormButton
        testID="onb-next"
        variant={topReady ? 'primary' : 'secondary'}
        label={top && !topReady ? DATA_COPY.later : DATA_COPY.continue}
        onPress={onNext}
      />
    </ScrollView>
  );
}
