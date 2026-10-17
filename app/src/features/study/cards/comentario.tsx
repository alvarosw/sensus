// Card de comentário (proto: comCard), matriz "quem comenta cada versículo" e filtro de tradição. Os três ficam juntos
// porque a lente de interpretação os usa em conjunto.
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Card, CardTop, fontFamilies, LinkButton, radius, space, Tag, Txt, TypeMark, useTheme } from '@/design';
import { ScriptText } from '@/features/rich';
import { useAutoTranslate } from '@/translate/useAutoTranslate';
import { AutoTranslateNote } from '@/translate/AutoTranslateNote';
import { useSourceLang } from '@/translate/source-lang';
import { STUDY } from '../strings';
import type { CommentaryView } from '../format';

// ---- comentário ----------------------------------------------------------------------------------------------------

export const CommentaryCard = memo(function CommentaryCard({
  view,
  refText,
  tokenByKey,
  authorFiltered,
  onOpen,
  onMoreByAuthor,
  onAsk,
}: {
  view: CommentaryView;
  refText: string;
  tokenByKey: ReadonlyMap<string, string>;
  authorFiltered: boolean;
  onOpen: () => void;
  onMoreByAuthor: () => void;
  onAsk: () => void;
}) {
  const tr = useAutoTranslate(view.body, useSourceLang(view.commentary.source_id));
  return (
    <Card testID={`com-${view.commentary.cite_id}`}>
      <CardTop>
        <TypeMark kind="com" label={STUDY.commentary} />
        <Txt v="bodySm" bold>{view.author}</Txt>
        {view.tradition ? <Tag label={view.tradition} /> : null}
        <Txt v="meta" color="muted" style={{ fontSize: 11.5 }}>{refText}</Txt>
      </CardTop>
      {tr.translated ? (
        <Txt v="excerpt" numberOfLines={4}>{tr.display}</Txt>
      ) : (
        <ScriptText text={view.body} numberOfLines={4} tokenByKey={tokenByKey} />
      )}
      <AutoTranslateNote tr={tr} testID={`com-tr-${view.commentary.cite_id}`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <LinkButton label={STUDY.readFull} onPress={onOpen} testID={`com-open-${view.commentary.cite_id}`} />
        <LinkButton label={authorFiltered ? STUDY.clearAuthor : STUDY.moreByAuthor} onPress={onMoreByAuthor} />
        <LinkButton label={STUDY.ask} onPress={onAsk} />
      </View>
    </Card>
  );
});

// ---- matriz "quem comenta cada versículo" ------------------------------------------------------------------------

const CELL_W = 24;
const CELL_H = 20;
const HEAD_H = 78;

export function CommentaryMatrix({
  rows,
  cols,
  hit,
  onPress,
}: {
  rows: { vid: number; label: string }[];
  cols: { key: string; label: string }[];
  hit: (vid: number, col: string) => { citeId: string; span: boolean; label: string } | undefined;
  onPress: (citeId: string) => void;
}) {
  const { c, st } = useTheme();
  const body = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        cells: cols.map((col) => hit(r.vid, col.key)),
      })),
    [rows, cols, hit],
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={STUDY.matrixLabel}>
      <View testID="matrix" style={{ gap: 3 }}>
        <View style={{ flexDirection: 'row', gap: 3, height: HEAD_H }}>
          <View style={{ width: 36 }} />
          {cols.map((col) => (
            <View key={col.key} style={{ width: CELL_W, height: HEAD_H }}>
              <View style={{ position: 'absolute', width: HEAD_H, height: CELL_W, left: (CELL_W - HEAD_H) / 2, top: (HEAD_H - CELL_W) / 2, transform: [{ rotate: '-90deg' }], justifyContent: 'center' }}>
                <Txt v="meta" color="muted" numberOfLines={1} style={{ fontSize: 10.5, fontFamily: fontFamilies.uiBold }}>{col.label}</Txt>
              </View>
            </View>
          ))}
        </View>
        {body.map((r) => (
          <View key={r.vid} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
            <View style={{ width: 36 }}>
              <Txt v="meta" color="muted" style={{ fontSize: 10.5, fontFamily: fontFamilies.uiBold }}>{r.label}</Txt>
            </View>
            {r.cells.map((cell, i) => (
              <View key={cols[i]!.key} style={{ width: CELL_W, height: CELL_H, borderRadius: 5, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
                {cell && (
                  <Pressable
                    testID={`matrix-${r.vid}-${cols[i]!.key}`}
                    accessibilityLabel={cell.label}
                    onPress={() => onPress(cell.citeId)}
                    hitSlop={2}
                    style={{ flex: 1, backgroundColor: st.com, opacity: cell.span ? 0.45 : 0.85 }}
                  />
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ---- filtro de tradição --------------------------------------------------------------------------------------------

export function FilterPill({ label, on, onPress, testID }: { label: string; on: boolean; onPress: () => void; testID?: string }) {
  const { c, st } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: on ? st.com : c.border,
        backgroundColor: on ? `${st.com}1A` : c.surface,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Txt v="meta" tint={on ? st.com : c.muted} style={{ fontSize: 12 }}>{label}</Txt>
    </Pressable>
  );
}
