// Seletor da Bíblia do leitor (barra superior): lista as instaladas, marca a atual e leva a Configurações > Bíblias
// para baixar mais. Escolher grava o texto padrão (settings/app-prefs.ts), como o antigo alternador BLivre/KJV.
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, Txt, radius, shadow, useTheme } from '@/design';
import { useAppPrefs } from '@/settings/app-prefs';
import { useBibles } from '@/data/bibles/bibles-store';
import { bibleRowInfo } from '@/data/bibles/bible-model';
import { BIBLE_COPY } from '@/data/bibles/strings';

export function BibleSourcePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const installed = useBibles((s) => s.installed);
  const catalog = useBibles((s) => s.catalog);
  const current = useAppPrefs((s) => s.textSource);

  const pick = (id: string) => {
    useAppPrefs.getState().setTextSource(id);
    onClose();
  };
  const more = () => {
    onClose();
    router.push('/settings/bibles');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable testID="bible-picker-scrim" accessibilityRole="button" accessibilityLabel={BIBLE_COPY.readerTitle} onPress={onClose} style={{ flex: 1, backgroundColor: c.scrim }} />
        <View
          testID="bible-picker"
          accessibilityViewIsModal
          style={[
            { backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: insets.bottom + 12, maxHeight: '70%' },
            shadow.sheet,
          ]}
        >
          <View style={{ height: 22, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: c.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
            <Txt v="sheetTitle" accessibilityRole="header" style={{ flex: 1 }}>{BIBLE_COPY.readerTitle}</Txt>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
            {installed.length === 0 ? <Txt v="bodySm" color="muted">{BIBLE_COPY.readerNone}</Txt> : null}
            {installed.map((id) => {
              const info = bibleRowInfo(id, catalog);
              const selected = id === current;
              return (
                <Pressable
                  key={id}
                  testID={`bible-pick-${id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${info.name} (${info.abbr})`}
                  onPress={() => pick(id)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    minHeight: 52,
                    paddingHorizontal: 14,
                    borderRadius: radius.card,
                    borderWidth: 1,
                    borderColor: selected ? c.accent : c.border,
                    backgroundColor: selected ? c.selected : c.surface,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt v="body" bold>{info.name}</Txt>
                    <Txt v="meta" color="muted">{info.abbr}</Txt>
                  </View>
                  {selected ? <Icon name="check" size={18} color={c.accent} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            testID="bible-picker-more"
            accessibilityRole="button"
            onPress={more}
            style={({ pressed }) => ({ marginHorizontal: 16, marginTop: 8, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <Txt v="button" color="accent" bold>{BIBLE_COPY.readerDownloadMore}</Txt>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
