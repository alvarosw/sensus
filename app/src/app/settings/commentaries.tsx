// Interpretação e comentários: quais tradições (e fontes de comentário) aparecem no estudo inteiro. Lista só o que o
// banco ativo tem (useSources). Tradição escolhida ou fonte escondida vale para lentes, painel e IA.
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { sourceShort } from '@sensus/core';
import { Card, ListGroup, Txt, useTheme } from '@/design';
import { useAppPrefs } from '@/settings/app-prefs';
import { commentaryGroups, toggleHiddenSource, toggleTradition } from '@/settings/commentary-model';
import { COMMENTARY_STRINGS as T } from '@/settings/commentary-strings';
import { SourceSwitchRow, TraditionChip } from '@/settings/commentary-parts';
import { useSources } from '@/settings/use-sources';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt v="eyebrow" color="muted" style={{ paddingLeft: 2 }}>{label}</Txt>
      {children}
    </View>
  );
}

export default function CommentariesScreen() {
  const { c } = useTheme();
  const { sources, error } = useSources();
  const pref = useAppPrefs((s) => s.commentaryPrefs);
  const setPrefs = useAppPrefs((s) => s.setCommentaryPrefs);
  const groups = useMemo(() => commentaryGroups(sources ?? []), [sources]);
  const allOn = pref.traditions === null;
  const update = (next: Partial<typeof pref>) => setPrefs({ ...pref, ...next });

  return (
    <ScrollView testID="settings-commentaries" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 22 }} contentInsetAdjustmentBehavior="automatic">
      <Txt v="bodySm" color="muted">{T.help}</Txt>

      <Section label={T.secTraditions}>
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <TraditionChip testID="trad-all" label={T.allTraditions} on={allOn} onPress={() => update({ traditions: null })} />
          {groups.map((g) => (
            <TraditionChip
              key={g.tradition}
              testID={`trad-${g.tradition}`}
              label={g.label}
              on={!allOn && (pref.traditions ?? []).includes(g.tradition)}
              onPress={() => update({ traditions: toggleTradition(pref.traditions, g.tradition) })}
            />
          ))}
        </Card>
      </Section>

      <Section label={T.secSources}>
        <Txt v="meta" color="muted" style={{ paddingLeft: 2 }}>{T.sourcesHelp}</Txt>
        {sources === null && !error ? <Txt v="bodySm" color="muted">…</Txt> : null}
        {sources !== null && groups.length === 0 ? <Txt v="bodySm" color="muted">{T.noSources}</Txt> : null}
        {groups.map((g) => (
          <View key={g.tradition} style={{ gap: 6 }}>
            <Txt v="meta" color="muted" style={{ paddingLeft: 2 }}>{g.label}</Txt>
            <ListGroup testID={`trad-group-${g.tradition}`}>
              {g.sources.map((s, i) => {
                const name = sourceShort(s.id, s.title);
                return (
                  <SourceSwitchRow
                    key={s.id}
                    testID={`src-switch-${s.id}`}
                    name={name}
                    detail={s.title !== name ? s.title : ''}
                    first={i === 0}
                    on={!pref.hiddenSources.includes(s.id)}
                    onChange={() => update({ hiddenSources: toggleHiddenSource(pref.hiddenSources, s.id) })}
                  />
                );
              })}
            </ListGroup>
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}
