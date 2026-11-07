// Configurações > Bíblias: instaladas (com remover; BLivre e KJV não saem), recomendadas para o idioma do app (a de
// rank 1 leva o selo) e as demais, agrupadas por idioma. Cada uma baixa, mostra progresso e tenta de novo em erro.
// Instalada com versão mais nova no catálogo, oferece baixar de novo (a troca é atômica, ver install.ts).
import { useEffect } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { findBible, recommendBibles, type BibleEntry } from '@sensus/core';
import { ListGroup, Txt, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { useAppPrefs } from '@/settings/app-prefs';
import { BibleRow } from '@/data/bibles/BibleRow';
import { useBibles } from '@/data/bibles/bibles-store';
import { bibleHasUpdate, bibleRowInfo, langName, type BibleRowInfo } from '@/data/bibles/bible-model';
import { bibleUiLang } from '@/data/bibles/ui-lang';
import { BIBLE_COPY } from '@/data/bibles/strings';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt v="eyebrow" color="muted" style={{ paddingLeft: 2 }}>{label}</Txt>
      {children}
    </View>
  );
}

export default function BiblesScreen() {
  const { c } = useTheme();
  const lang = bibleUiLang();
  const catalog = useBibles((s) => s.catalog);
  const catalogError = useBibles((s) => s.catalogError);
  const checking = useBibles((s) => s.checking);
  const installed = useBibles((s) => s.installed);
  const machines = useBibles((s) => s.machines);
  const versions = useBibles((s) => s.versions);
  const refreshCatalog = useBibles((s) => s.refreshCatalog);
  const install = useBibles((s) => s.install);
  const cancel = useBibles((s) => s.cancel);
  const remove = useBibles((s) => s.remove);

  useEffect(() => {
    void refreshCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rec = catalog ? recommendBibles(catalog, lang) : null;
  // Instaladas que o catálogo não lista (BLivre e KJV quando o catálogo não as traz, ou sem catálogo nenhum).
  const orphans: BibleRowInfo[] = installed.filter((id) => !findBible(catalog, id)).map((id) => bibleRowInfo(id, catalog));
  const hasBundled = installed.some((id) => bibleRowInfo(id, catalog).bundled);

  const confirmRemove = (info: BibleRowInfo) => {
    Alert.alert(BIBLE_COPY.removeTitle(info.abbr), BIBLE_COPY.removeBody, [
      { text: BIBLE_COPY.cancel, style: 'cancel' },
      {
        text: BIBLE_COPY.removeConfirm,
        style: 'destructive',
        onPress: () => void remove(info.id).then(() => useAppPrefs.getState().syncTextSource()),
      },
    ]);
  };

  const rowFor = (entry: BibleEntry, first: boolean, badge: boolean) => {
    const info = bibleRowInfo(entry.id, catalog);
    return (
      <BibleRow
        key={entry.id}
        info={info}
        installed={installed.includes(entry.id)}
        update={bibleHasUpdate(entry, versions[entry.id])}
        badge={badge}
        first={first}
        machine={machines[entry.id] ?? { phase: 'idle', bytes: 0, total: 0, attempt: 1 }}
        onInstall={() => install(entry.id)}
        onCancel={() => cancel(entry.id)}
        onRemove={() => confirmRemove(info)}
      />
    );
  };

  return (
    <ScrollView testID="settings-bibles" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 22 }} contentInsetAdjustmentBehavior="automatic">
      {catalogError ? <Txt v="bodySm" tint={c.danger} testID="bibles-error">{BIBLE_COPY.catalogError}</Txt> : null}
      {catalog && catalogError ? <Txt v="bodySm" color="muted">{BIBLE_COPY.catalogCached}</Txt> : null}

      {orphans.length > 0 ? (
        <Section label={BIBLE_COPY.installedTitle}>
          <ListGroup testID="bibles-installed">
            {orphans.map((info, i) => (
              <BibleRow
                key={info.id}
                info={info}
                installed
                badge={false}
                first={i === 0}
                machine={{ phase: 'idle', bytes: 0, total: 0, attempt: 1 }}
                onInstall={() => undefined}
                onCancel={() => undefined}
                onRemove={() => confirmRemove(info)}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {rec ? (
        <>
          <Section label={BIBLE_COPY.recommendedTitle(langName(lang))}>
            <ListGroup testID="bibles-recommended">
              {rec.recommended.map((entry, i) => rowFor(entry, i === 0, entry.rank === 1))}
            </ListGroup>
          </Section>
          {rec.others.map((group) => (
            <Section key={group.lang} label={`${BIBLE_COPY.othersTitle}: ${langName(group.lang)}`}>
              <ListGroup testID={`bibles-lang-${group.lang}`}>
                {group.bibles.map((entry, i) => rowFor(entry, i === 0, false))}
              </ListGroup>
            </Section>
          ))}
        </>
      ) : null}

      {catalog && catalog.bibles.length === 0 ? <Txt v="bodySm" color="muted">{BIBLE_COPY.catalogEmpty}</Txt> : null}
      {hasBundled ? <Txt v="bodySm" color="muted">{BIBLE_COPY.bundledNote}</Txt> : null}

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
