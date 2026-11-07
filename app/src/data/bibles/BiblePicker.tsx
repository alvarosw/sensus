// Lista de Bíblias para baixar e escolher a principal: a curta (recomendadas do idioma do app e do inglês, mais as
// baixadas) e, pelo botão, todas as outras agrupadas por idioma (idioma do app, inglês, espanhol, demais). Usada em
// Configurações > Bíblias e no passo de Bíblia da apresentação. A principal é a preferência textSource (settings):
// quem usa passa a atual e grava a escolha (esta camada não importa settings).
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { bibleLanguageGroups, findBible, suggestedBibles, type BibleEntry } from '@sensus/core';
import { Txt } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { IDLE_STATE } from '../download-machine';
import { BibleRow } from './BibleRow';
import { useBibles } from './bibles-store';
import { bibleHasUpdate, bibleRowInfo, canRemoveBible, langName, resolveTextSource, type BibleRowInfo } from './bible-model';
import { BIBLE_COPY } from './strings';

export interface BiblePickerProps {
  /** Idioma do app (decide as recomendadas e a ordem dos idiomas). */
  lang: string;
  /** Id da Bíblia principal (preferência textSource). */
  principal: string;
  onSelect: (id: string) => void;
}

function Section({ label, children, testID }: { label: string; children: React.ReactNode; testID?: string }) {
  return (
    <View style={{ gap: 8 }} testID={testID}>
      <Txt v="eyebrow" color="muted" style={{ paddingLeft: 2 }}>{label}</Txt>
      {children}
    </View>
  );
}

export function BiblePicker({ lang, principal, onSelect }: BiblePickerProps) {
  const catalog = useBibles((s) => s.catalog);
  const installed = useBibles((s) => s.installed);
  const machines = useBibles((s) => s.machines);
  const versions = useBibles((s) => s.versions);
  const install = useBibles((s) => s.install);
  const cancel = useBibles((s) => s.cancel);
  const remove = useBibles((s) => s.remove);
  const [showAll, setShowAll] = useState(false);

  const suggested = catalog ? suggestedBibles(catalog, lang, installed) : [];
  const recommended = new Set(catalog ? suggestedBibles(catalog, lang, []).map((b) => b.id) : []);
  // Baixadas que o catálogo não lista (saíram dele, ou sem catálogo nenhum ainda): pelo registro de fontes.
  const orphans: BibleRowInfo[] = installed.filter((id) => !findBible(catalog, id)).map((id) => bibleRowInfo(id, catalog));
  const shown = new Set([...suggested.map((b) => b.id), ...orphans.map((o) => o.id)]);
  const groups = catalog
    ? bibleLanguageGroups(catalog, lang)
        .map((g) => ({ ...g, bibles: g.bibles.filter((b) => !shown.has(b.id)) }))
        .filter((g) => g.bibles.length > 0)
    : [];

  const askRemove = (info: BibleRowInfo) => {
    if (!canRemoveBible(info.id, installed)) {
      Alert.alert(BIBLE_COPY.keepOneTitle, BIBLE_COPY.keepOneBody);
      return;
    }
    const rest = installed.filter((id) => id !== info.id);
    const next = info.id === principal ? bibleRowInfo(resolveTextSource({ stored: null, installed: rest, catalog, lang }), catalog).name : null;
    Alert.alert(BIBLE_COPY.removeTitle(info.abbr), next ? BIBLE_COPY.removePrincipalBody(next) : BIBLE_COPY.removeBody, [
      { text: BIBLE_COPY.cancel, style: 'cancel' },
      { text: BIBLE_COPY.removeConfirm, style: 'destructive', onPress: () => void remove(info.id) },
    ]);
  };

  const row = (info: BibleRowInfo, entry: BibleEntry | null) => {
    const isInstalled = installed.includes(info.id);
    return (
      <BibleRow
        key={info.id}
        info={info}
        installed={isInstalled}
        principal={isInstalled && info.id === principal}
        update={bibleHasUpdate(entry, versions[info.id])}
        updateVersion={entry?.version}
        badge={recommended.has(info.id)}
        machine={machines[info.id] ?? IDLE_STATE}
        onInstall={() => install(info.id)}
        onCancel={() => cancel(info.id)}
        onRemove={() => askRemove(info)}
        onSelect={() => onSelect(info.id)}
      />
    );
  };

  return (
    <View style={{ gap: 18 }}>
      {suggested.length + orphans.length > 0 ? (
        <Section label={BIBLE_COPY.suggestedTitle} testID="bibles-suggested">
          <View style={{ gap: 8 }}>
            {suggested.map((entry) => row(bibleRowInfo(entry.id, catalog), entry))}
            {orphans.map((info) => row(info, null))}
          </View>
          {installed.length > 1 ? <Txt v="meta" color="muted" style={{ paddingHorizontal: 2 }}>{BIBLE_COPY.principalHint}</Txt> : null}
        </Section>
      ) : null}

      {showAll && groups.length > 0 ? <Txt v="body" bold style={{ paddingHorizontal: 2, marginTop: 6 }}>{BIBLE_COPY.allTitle}</Txt> : null}
      {showAll
        ? groups.map((g) => (
            <Section key={g.lang} label={langName(g.lang)} testID={`bibles-lang-${g.lang}`}>
              <View style={{ gap: 8 }}>{g.bibles.map((entry) => row(bibleRowInfo(entry.id, catalog), entry))}</View>
            </Section>
          ))
        : null}

      {groups.length > 0 ? (
        <FormButton
          testID="bibles-show-all"
          variant="secondary"
          label={showAll ? BIBLE_COPY.hideAll : BIBLE_COPY.showAll}
          onPress={() => setShowAll((v) => !v)}
        />
      ) : null}
    </View>
  );
}
