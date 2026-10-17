// Cabeçalho da folha: título da perícope (ou seleção), contagem de versículos, cruzamentos de capítulo e livro,
// fonte do texto e os botões de altura e de fechar.
import { View } from 'react-native';
import { IconButton, Tag, Txt, gutter, space, type Detent } from '@/design';
import { refShort } from '@/features/common/format';
import { sourceShort, splitVid } from '@sensus/core';
import { useStudy } from '@/state/study';
import { refTitle } from './format';
import { STUDY } from './strings';
import { useStudyData } from './useStudyData';

export function SheetHead({ detent }: { detent: Detent }) {
  const { range, books, edges, textSource } = useStudyData();
  const setDetent = useStudy((s) => s.setDetent);
  const clearSelection = useStudy((s) => s.clearSelection);
  const title = refTitle(range.start, range.end, books);
  const a = splitVid(range.start);
  const b = splitVid(range.end);
  const count = edges?.count ?? (a.book === b.book && a.chapter === b.chapter ? b.verse - a.verse + 1 : null);
  const crosses = a.book === b.book && a.chapter !== b.chapter;
  const crossesBook = a.book !== b.book;

  return (
    <View style={{ paddingHorizontal: gutter.sheet, paddingBottom: space[4], flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="sheetTitle" testID="sheet-title" numberOfLines={2}>{title}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {count !== null && (
            <Txt v="meta" color="muted" style={{ fontWeight: '400' }}>{`${count} ${count === 1 ? STUDY.verse : STUDY.verses}`}</Txt>
          )}
          {crosses && <Tag tone="tint" label={STUDY.crosses(String(a.chapter), String(b.chapter))} />}
          {crossesBook && <Tag tone="tint" label={STUDY.crosses(refShort(range.start, range.start, books, true).split(' ')[0]!, refShort(range.end, range.end, books, true).split(' ')[0]!)} />}
          <Txt v="meta" color="muted">{`· ${sourceShort(textSource)}`}</Txt>
        </View>
      </View>
      <IconButton
        testID="sheet-expand"
        icon={detent === 'peek' ? 'chevronUp' : 'chevronDown'}
        label={detent === 'peek' ? STUDY.expand : STUDY.collapse}
        onPress={() => setDetent(detent === 'peek' ? 'half' : 'peek')}
      />
      <IconButton testID="sheet-close" icon="close" label={STUDY.close} onPress={clearSelection} />
    </View>
  );
}
