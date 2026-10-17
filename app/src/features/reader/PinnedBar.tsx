// Referência cruzada fixada sob a barra superior (lado a lado): ref (cor xr) + texto do destino + fechar.
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, Txt, fontFamilies, shadow, useTheme } from '@/design';
import { useRepo } from '@/data/db-context';
import { useStudy } from '@/state/study';
import { BACK_PRIORITY, useBackLayer } from '../common/back';
import { refShort } from '../common/format';
import { READER } from './strings';

export function PinnedBar() {
  const { c, st } = useTheme();
  const repo = useRepo();
  const pinned = useStudy((s) => s.pinned);
  const source = useStudy((s) => s.textSource);
  const [text, setText] = useState('');
  useBackLayer('pinned', pinned != null, () => useStudy.getState().pin(null), BACK_PRIORITY.pinned);

  useEffect(() => {
    if (!pinned) {
      setText('');
      return;
    }
    let alive = true;
    void repo.verseTexts(source, { start: pinned.start, end: pinned.end }).then((vs) => alive && setText(vs.map((v) => v.text).join(' ')));
    return () => {
      alive = false;
    };
  }, [repo, source, pinned?.start, pinned?.end]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pinned) return null;
  return (
    <View
      testID="pinned"
      style={[
        { zIndex: 4, flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border, paddingTop: 10, paddingBottom: 12, paddingHorizontal: 14 },
        shadow.pin,
      ]}
    >
      <Txt v="meta" tint={st.xr} bold style={{ fontFamily: fontFamilies.uiBold, paddingTop: 2 }}>
        {refShort(pinned.start, pinned.end, [], true)}
      </Txt>
      <Txt v="excerpt" style={{ flex: 1, minWidth: 0, lineHeight: 20.3 }}>{text}</Txt>
      <Pressable
        testID="pinned-close"
        accessibilityRole="button"
        accessibilityLabel={READER.unpin}
        hitSlop={8}
        onPress={() => useStudy.getState().pin(null)}
        style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="close" size={11} color={c.muted} />
      </Pressable>
    </View>
  );
}
