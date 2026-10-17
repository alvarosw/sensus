// Card de referência cruzada (proto: xrCard): destino, origem, peso e trecho do versículo citado.
import { View } from 'react-native';
import { formatShortRef, type Book, type XRef } from '@sensus/core';
import { Card, LinkButton, MeterBar, space, Txt, TypeMark, useTheme } from '@/design';
import { chv } from '@/features/common/format';
import { useAutoTranslate } from '@/translate/useAutoTranslate';
import { AutoTranslateNote } from '@/translate/AutoTranslateNote';
import { useSourceLang } from '@/translate/source-lang';
import { useStudy } from '@/state/study';
import { STUDY } from '../strings';

// ---- referência cruzada ---------------------------------------------------------------------------------------------

export function XrefCard({
  xref,
  text,
  relevance,
  books,
  onPin,
  onAsk,
}: {
  xref: XRef;
  text: string;
  /** 0..1 */
  relevance: number;
  books: readonly Book[];
  onPin: () => void;
  onAsk: () => void;
}) {
  const { st } = useTheme();
  const textSource = useStudy((s) => s.textSource);
  const tr = useAutoTranslate(text || null, useSourceLang(textSource));
  const dest = formatShortRef(xref.to_start_vid, xref.to_end_vid, books as Book[], true);
  return (
    <Card testID={`xref-${xref.cite_id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
        <TypeMark kind="xr" label={STUDY.xrefType} />
        <Txt v="body" bold tint={st.xr} style={{ fontSize: 13.5, flexShrink: 1 }}>{dest}</Txt>
        <Txt v="meta" color="muted" style={{ fontSize: 11.5 }}>{`${STUDY.from} ${chv(xref.from_vid)}`}</Txt>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <MeterBar value={relevance} color={st.xr} width={44} height={5} />
          <Txt v="meta" color="muted" style={{ fontSize: 10.5 }}>{Math.round(xref.weight ?? 0)}</Txt>
        </View>
      </View>
      {text ? <Txt v="excerpt" numberOfLines={3}>{tr.display}</Txt> : null}
      {text ? <AutoTranslateNote tr={tr} testID={`xref-tr-${xref.cite_id}`} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <LinkButton label={STUDY.pinSideBySide} onPress={onPin} testID={`xref-pin-${xref.cite_id}`} />
        <LinkButton label={STUDY.ask} onPress={onAsk} />
      </View>
    </Card>
  );
}
