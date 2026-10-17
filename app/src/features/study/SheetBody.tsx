// Corpo rolável da folha: prévia ("espiar") e lentes numa só rolagem, com o trilho sobreposto no topo. A lente-alvo
// e a âncora de rolagem ficam aqui.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LENS_KEYS, useStudy, type LensKey } from '@/state/study';
import { LENS_VIEWS } from './lenses';
import { PeekContent } from './PeekContent';
import { Rail } from './Rail';

export function SheetBody({ open, atFull, bottomInset, onPeekLayout, onRailLayout }: { open: boolean; atFull: boolean; bottomInset: number; onPeekLayout: (h: number) => void; onRailLayout: (h: number) => void }) {
  const lensTarget = useStudy((s) => s.lensTarget);
  const setLens = useStudy((s) => s.setLens);
  const scroll = useRef<ScrollView>(null);
  // Altura de cada lente medida pelo onLayout; y de uma lente = soma das alturas das anteriores.
  const lensH = useRef<Partial<Record<LensKey, number>>>({});
  const yOf = useCallback((k: LensKey): number | undefined => {
    let y = 0;
    for (const key of LENS_KEYS) {
      if (key === k) return lensH.current[key] === undefined ? undefined : y;
      const h = lensH.current[key];
      if (h === undefined) return undefined;
      y += h;
    }
    return undefined;
  }, []);
  const peekH = useRef(0);
  const railH = useRef(0);
  const [viewH, setViewH] = useState(0);
  const [railSpacer, setRailSpacer] = useState(0);
  const peekSv = useSharedValue(0);
  const scrollY = useSharedValue(0);
  // Trilho: encosta abaixo do espiar e sobe junto com a rolagem até colar no topo.
  const railStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(0, peekSv.value - scrollY.value) }] }));
  const current = useRef<LensKey>(useStudy.getState().lens);
  const openRef = useRef(open);
  openRef.current = open;

  // Lente-alvo: o pedido fica pendente até a folha estar aberta e as lentes medidas. Depois disso a lente
  // vira "âncora": enquanto o conteúdo acima muda de altura (fontes, resumo da IA), a rolagem é refeita para
  // ela; o primeiro gesto do usuário solta a âncora.
  const pending = useRef<LensKey | null>(null);
  const anchor = useRef<LensKey | null>(null);
  const progUntil = useRef(0);

  const scrollToLens = useCallback(
    (k: LensKey, animated: boolean): boolean => {
      const y = yOf(k);
      if (y === undefined) return false;
      // A lente começa logo abaixo do trilho colado no topo: offset = espiar + y (espiar + trilho + y - trilho).
      progUntil.current = Date.now() + (animated ? 900 : 250);
      scroll.current?.scrollTo({ y: Math.max(0, peekH.current + y), animated });
      return true;
    },
    [yOf],
  );

  const flush = useCallback(() => {
    const k = pending.current;
    if (!k || !openRef.current) return;
    if (scrollToLens(k, true)) {
      pending.current = null;
      anchor.current = k;
      useStudy.getState().consumeLensTarget();
    }
  }, [scrollToLens]);

  const reanchor = useCallback(() => {
    const k = anchor.current;
    if (k) scrollToLens(k, false);
  }, [scrollToLens]);

  useEffect(() => {
    if (!lensTarget) return;
    pending.current = lensTarget;
    flush();
  }, [lensTarget, open, flush]);

  // Ao voltar para "espiar" a rolagem recomeça do topo.
  useEffect(() => {
    if (open) return;
    anchor.current = null;
    scrollY.value = 0;
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [open, scrollY]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const top = e.nativeEvent.contentOffset.y;
      scrollY.value = top;
      // Durante uma rolagem pedida pelo trilho, a lente marcada já é a pedida.
      if (Date.now() < progUntil.current) return;
      // Lente atual: a última cujo topo já passou da linha logo abaixo do trilho.
      let cur: LensKey = 'visao';
      for (const k of LENS_KEYS) {
        const ly = yOf(k);
        if (ly !== undefined && peekH.current + ly <= top + 24) cur = k;
      }
      if (cur !== current.current) {
        current.current = cur;
        setLens(cur);
      }
    },
    [scrollY, setLens, yOf],
  );

  const onScrollBeginDrag = useCallback(() => {
    anchor.current = null;
  }, []);

  const onPeek = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    peekH.current = h;
    peekSv.value = h;
    onPeekLayout(h);
    reanchor();
  };

  const onRail = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h === railH.current) return;
    railH.current = h;
    setRailSpacer(h);
    onRailLayout(h);
    reanchor();
  };

  const registerLens = (k: LensKey) => (e: LayoutChangeEvent) => {
    lensH.current[k] = e.nativeEvent.layout.height;
    if (pending.current) flush();
    else reanchor();
  };

  return (
    // No detent cheio a folha chega à base da tela: a rolagem termina acima da barra de navegação do Android
    // (inset inferior), senão links no meio do conteúdo, como "Ver no mapa", ficam atrás dela.
    <View style={{ flex: 1, paddingBottom: atFull ? bottomInset : 0 }}>
      <ScrollView
        ref={scroll}
        testID="sheet-scroll"
        style={{ flex: 1 }}
        scrollEnabled={open}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        // Espaço no fim: qualquer lente, inclusive a última, consegue ficar no topo.
        contentContainerStyle={{ paddingBottom: open ? viewH + 40 + bottomInset : 0 }}
      >
        <PeekContent onLayout={onPeek} />
        <View style={{ height: railSpacer }} />
        {open ? (
          <View>
            {LENS_KEYS.map((k) => {
              const View_ = LENS_VIEWS[k];
              return <View_ key={k} onLayout={registerLens(k)} />;
            })}
          </View>
        ) : null}
      </ScrollView>
      <Animated.View onLayout={onRail} style={[{ position: 'absolute', left: 0, right: 0, top: 0 }, railStyle]}>
        <Rail active={open} />
      </Animated.View>
    </View>
  );
}
