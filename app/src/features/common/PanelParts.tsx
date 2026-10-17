// Peças comuns dos painéis empilhados: chips de referência, linha de licença, pares chave/valor.
import { Linking, Pressable, View } from 'react-native';
import type { Book, Source, Vid } from '@sensus/core';
import { fontFamilies, Txt, useTheme } from '@/design';
import { refShort } from './format';
import { SRC } from './strings';

/** Chips de referência (proto: .refs button / .here). `here` realça a ocorrência atual. */
export function RefChips({
  vids,
  books,
  here,
  onPress,
  testIDPrefix = 'ref',
}: {
  vids: Vid[];
  books: Book[];
  here?: Vid | null;
  onPress: (vid: Vid) => void;
  testIDPrefix?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
      {vids.map((vid) => {
        const on = vid === here;
        return (
          <Pressable
            key={vid}
            testID={`${testIDPrefix}-${vid}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onPress(vid)}
            hitSlop={3}
            style={({ pressed }) => ({
              backgroundColor: on ? c.selected : c.surfaceAlt,
              borderRadius: 7,
              paddingHorizontal: 8,
              paddingVertical: 3,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Txt v="meta" tint={on ? c.accent : c.text} style={{ fontVariant: ['tabular-nums'] }}>
              {refShort(vid, vid, books, true)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pares chave/valor (proto: .kv). */
export function KeyValues({ rows }: { rows: { key: string; value: string }[] }) {
  return (
    <View style={{ gap: 4 }}>
      {rows.map((r, i) => (
        <View key={`${r.key}-${i}`} style={{ flexDirection: 'row', gap: 12 }}>
          <Txt v="bodySm" color="muted" style={{ width: 84, fontSize: 13, lineHeight: 18 }}>{r.key}</Txt>
          <Txt v="bodySm" bold style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>{r.value}</Txt>
        </View>
      ))}
    </View>
  );
}

/** Rodapé de licença (proto: .lic): fonte, licença, atribuição, links e cite_id. */
export function LicenseBlock({
  sources,
  citeId,
  summary,
}: {
  sources: (Source | undefined)[];
  citeId: string;
  /** Texto curto no lugar do título das fontes (ex.: "TAGNT e TBESG"). */
  summary?: string;
}) {
  const { c } = useTheme();
  const list = sources.filter((s): s is Source => !!s);
  const first = list[0];
  return (
    <View testID="license" style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, gap: 6 }}>
      <Txt v="meta" color="muted" style={{ fontFamily: fontFamilies.ui, fontSize: 11.5, lineHeight: 16 }}>
        {summary ?? list.map((s) => s.title).join(' · ')}
        {first ? ` · ${first.license}` : ''}
        {first?.author ? ` · ${first.author}` : ''}
      </Txt>
      {first?.attribution ? (
        <Txt v="meta" color="muted" style={{ fontFamily: fontFamilies.ui, fontSize: 11.5, lineHeight: 16 }} selectable>
          {first.attribution}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
        {first && /^https?:\/\//.test(first.url) ? (
          <LinkText label={SRC.origin} url={first.url} testID="license-origin" />
        ) : null}
        {first?.license_url ? <LinkText label={SRC.licenseOpen} url={first.license_url} testID="license-url" /> : null}
      </View>
      <Txt v="mono" color="muted" selectable>{citeId}</Txt>
    </View>
  );
}

export function LinkText({ label, url, testID }: { label: string; url: string; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="link" onPress={() => Linking.openURL(url)} hitSlop={6}>
      <Txt v="meta" color="accent" bold style={{ textDecorationLine: 'underline' }}>{label}</Txt>
    </Pressable>
  );
}
