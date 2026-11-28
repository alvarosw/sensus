// Pílula de navegação de resultados no leitor: "‹ n de N · termo › · Lista · ✕". Passa ao resultado anterior ou ao
// próximo sem voltar à lista; Lista reabre a tela de busca; ✕ fecha e deixa a pessoa lendo.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, Txt, radius, shadow, space, useTheme } from '@/design';
import { useReaderNav } from '@/state/reader-nav';
import { useSearch } from './search-store';
import { SEARCH } from './strings';

export function SearchNavPill({ top }: { top: number }) {
  const { c } = useTheme();
  const nav = useSearch((s) => s.nav);
  if (!nav) return null;
  const go = (delta: -1 | 1) => {
    const vid = useSearch.getState().step(delta);
    if (vid !== null) useReaderNav.getState().goVerse(vid, { flash: true });
  };
  const btn = (testID: string, label: string, onPress: () => void, child: ReactNode, disabled = false) => (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={4} style={({ pressed }) => ({ minWidth: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}>
      {child}
    </Pressable>
  );
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top, alignItems: 'center', zIndex: 6 }}>
      <View testID="search-nav" style={[{ flexDirection: 'row', alignItems: 'center', gap: 2, padding: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }, shadow.pop]}>
        {btn('search-nav-prev', SEARCH.prev, () => go(-1), <Icon name="chevronLeft" size={16} color={c.text} />, nav.index === 0)}
        <Txt v="meta" color="muted" numberOfLines={1} style={{ maxWidth: 170, paddingHorizontal: space[2] }}>{SEARCH.navLabel(nav.index + 1, nav.hits.length, nav.query)}</Txt>
        {btn('search-nav-next', SEARCH.next, () => go(1), <Icon name="chevronRight" size={16} color={c.text} />, nav.index >= nav.hits.length - 1)}
        <View style={{ width: 1, height: 20, backgroundColor: c.border }} />
        {btn('search-nav-list', SEARCH.list, () => router.push('/search'), <Txt v="button">{SEARCH.list}</Txt>)}
        {btn('search-nav-close', SEARCH.closeNav, () => useSearch.getState().setNav(null), <Icon name="close" size={12} color={c.text} />)}
      </View>
    </View>
  );
}
