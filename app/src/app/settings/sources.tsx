// Fontes e licenças: todas as fontes do banco (tabela source), agrupadas por licença. Cada uma abre com
// autor, licença, atribuição exigida e o link de origem.
import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Icon, ListGroup, Txt, useTheme } from '@/design';
import type { Source } from '@sensus/core';
import { licenseGroupOf, useSources, type LicenseGroup } from '@/settings/use-sources';
import { SETTINGS_COPY as COPY } from '@/settings/strings';

const GROUP_TITLE: Record<LicenseGroup, string> = {
  cc: COPY.groupCc,
  nc: COPY.groupNonCommercial,
  pd: COPY.groupPublicDomain,
  other: COPY.groupOther,
};
const GROUP_ORDER: LicenseGroup[] = ['cc', 'nc', 'pd', 'other'];

function openLink(url: string | null) {
  if (url && /^https:\/\//.test(url)) void Linking.openURL(url);
}

function SourceItem({ source, first, open, onToggle }: { source: Source; first: boolean; open: boolean; onToggle: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}>
      <Pressable
        testID={`source-${source.id}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={source.title}
        onPress={onToggle}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt v="bodySm" bold>{source.title}</Txt>
          <Txt v="meta" color="muted">{source.license}</Txt>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={14} color={c.muted} />
        </View>
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
          {source.author ? <Txt v="bodySm"><Txt v="bodySm" color="muted">{COPY.authorLabel}: </Txt>{source.author}</Txt> : null}
          <Txt v="bodySm"><Txt v="bodySm" color="muted">{COPY.licenseLabel}: </Txt>{source.license}</Txt>
          {source.attribution ? (
            <View style={{ gap: 2 }}>
              <Txt v="eyebrow" color="muted">{COPY.attributionLabel}</Txt>
              <Txt v="bodySm">{source.attribution}</Txt>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            {source.url ? (
              <Pressable testID={`source-open-${source.id}`} accessibilityRole="link" onPress={() => openLink(source.url)} hitSlop={6}>
                <Txt v="button" color="accent">{COPY.openSource}</Txt>
              </Pressable>
            ) : null}
            {source.license_url ? (
              <Pressable accessibilityRole="link" onPress={() => openLink(source.license_url)} hitSlop={6}>
                <Txt v="button" color="accent">{COPY.licenseLink}</Txt>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function SourcesScreen() {
  const { c } = useTheme();
  const { sources, error } = useSources();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = GROUP_ORDER.map((g) => ({
    key: g,
    rows: (sources ?? []).filter((s) => licenseGroupOf(s.license) === g),
  })).filter((g) => g.rows.length > 0);

  return (
    <ScrollView testID="settings-sources" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 22 }} contentInsetAdjustmentBehavior="automatic">
      {sources === null ? <Txt v="bodySm" color="muted">{COPY.sourcesLoading}</Txt> : null}
      {error || (sources !== null && sources.length === 0) ? <Txt v="bodySm" color="muted">{COPY.noSources}</Txt> : null}
      {groups.map((g) => (
        <View key={g.key} style={{ gap: 8 }}>
          <Txt v="eyebrow" color="muted" style={{ paddingLeft: 2 }}>{GROUP_TITLE[g.key]}</Txt>
          <ListGroup>
            {g.rows.map((s, i) => (
              <SourceItem
                key={s.id}
                source={s}
                first={i === 0}
                open={!!open[s.id]}
                onToggle={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
              />
            ))}
          </ListGroup>
        </View>
      ))}
    </ScrollView>
  );
}
