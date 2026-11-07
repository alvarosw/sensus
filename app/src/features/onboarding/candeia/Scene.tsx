// Abertura do onboarding: noite, uma candeia de barro acende e o versículo aparece onde a luz passa.
//
// Camadas, de baixo para cima (a ordem dos filhos é a ordem de pintura):
//   fundo noturno → versículo (Text real, acessível) → véu escuro com um furo de luz que segue a candeia →
//   brasas (o que já foi iluminado guarda um brilho) → escuridão do acender → poça de luz e halo da chama →
//   vinheta → candeia e chama → referência, título, botão e dica.
//
// Tudo que se move por quadro roda na thread de UI: um único useFrameCallback avança o relógio, o caminho
// automático, a física da candeia (mola, balanço, chama que deita) e marca as palavras alcançadas pela luz. A
// tela só re-renderiza nas trocas de fase (acender, caminho, leitor assume, fim).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type TextLayoutEventData,
  type NativeSyntheticEvent,
  type TextStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamilies } from '@/design';
import { LampBody, LampLight, LAMP_BOX, WICK_FROM_CENTER } from './LampArt';
import { RadialLight, VeilFrame, VeilHole, Vignette } from './LightArt';
import { LiveFlame } from './LiveFlame';
import { flameBox } from './FlameArt';
import { flicker } from './noise';
import { light, night } from './palette';
import {
  litBy,
  pathDuration,
  planPath,
  samplePath,
  segmentLines,
  visibleLines,
  type PathPoint,
  type Segment,
  type TextLine,
} from './path';
import { restingSim, stepLamp, type LampSim } from './physics';
import { linesFromDom, linesFromNative } from './textLines';

export interface CandeiaSceneProps {
  title: string;
  verse: string;
  reference: string;
  hint: string;
  ctaLabel: string;
  onContinue: () => void;
  rtl?: boolean;
  testID?: string;
}

type Phase = 'intro' | 'auto' | 'user' | 'done';

// Modos da thread de UI.
const M_INTRO = 0;
const M_AUTO = 1;
const M_USER = 2;
const M_REST = 3;
const M_FREE = 4;
const M_APPROACH = 5;

/** Elipse da luz que "acende" uma palavra (px). */
const MARK_RX = 34;
const MARK_RY = 26;
/** Brilho residual de uma palavra já iluminada. */
const EMBER = 0.62;
/** Sem tocar depois de assumir, a escuridão recua sozinha (s). */
const IDLE_FINISH = 6;
/** Escuro antes da faísca e duração do acender (ms). */
const IGNITE_DELAY = 700;
const IGNITE_MS = 1700;

const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
const EASE_IN_OUT = Easing.bezier(0.45, 0, 0.25, 1);
// Acender: a faísca demora a pegar e depois a chama sobe.
const EASE_IGNITE = Easing.bezier(0.35, 0, 0.2, 1);

function verseStyle(len: number): TextStyle {
  const fontSize = len > 72 ? 24 : len > 56 ? 26 : 28;
  return { fontFamily: fontFamilies.read, fontSize, lineHeight: Math.round(fontSize * 1.56), textAlign: 'center' };
}

export function CandeiaScene({ title, verse, reference, hint, ctaLabel, onContinue, rtl = false, testID }: CandeiaSceneProps) {
  const reduce = useReducedMotion();
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    // Na web o react-native-web sempre responde "sim"; lá vale só o "reduzir movimento".
    if (Platform.OS === 'web') return;
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => alive && setScreenReader(on))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // Com "reduzir movimento" ou leitor de tela, a cena já começa no fim: versículo legível, candeia acesa parada.
  const still = reduce || screenReader;
  const insets = useSafeAreaInsets();

  const [screen, setScreen] = useState<{ w: number; h: number } | null>(null);
  const [para, setPara] = useState<LayoutRectangle | null>(null);
  const [spacer, setSpacer] = useState<LayoutRectangle | null>(null);
  const [lines, setLines] = useState<TextLine[] | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const textRef = useRef<Text>(null);

  const vStyle = useMemo(() => verseStyle(Array.from(verse).length), [verse]);
  const dir: TextStyle = rtl ? { writingDirection: 'rtl' } : { writingDirection: 'ltr' };

  // ---- medidas -----------------------------------------------------------------------------------------
  const W = screen?.w ?? 0;
  const H = screen?.h ?? 0;
  const lw = Math.max(112, Math.min(150, W * 0.34));
  const lh = (lw * LAMP_BOX.h) / LAMP_BOX.w;
  const flameH = lw * 0.3;
  const fbox = flameBox(flameH);
  const mirror = rtl ? -1 : 1;
  // Boca do pavio e centro da luz em relação ao ponto de apoio (centro da candeia).
  const wickOff = { x: WICK_FROM_CENTER.x * lw * mirror, y: WICK_FROM_CENTER.y * lw };
  const lift = lw * 0.42;
  const lightOff = { x: wickOff.x, y: wickOff.y - lift };
  const R = Math.max(150, Math.min(200, W * 0.42));
  // Furo largo e baixo: a luz corre ao longo da linha e pouco desce para a de baixo.
  const hole = { w: 2.7 * R, h: 1.35 * R };
  /** O furo fica um pouco acima do centro da luz: ilumina a linha lida e as de cima, menos a de baixo. */
  const holeUp = 10;
  const shadow = { w: lw * 1.9, h: lw * 1.05 };
  const reach = Math.max(W, H) * 1.3 + 2 * R;
  const pool = 2.7 * R;
  const bloom = flameH * 3.4;

  const segs = useMemo<Segment[]>(() => (lines ? segmentLines(lines, rtl) : []), [lines, rtl]);
  const vis = useMemo(() => (lines ? visibleLines(lines) : []), [lines]);

  // ---- estado da thread de UI -------------------------------------------------------------------------
  const clock = useSharedValue(0);
  const mode = useSharedValue(still ? M_REST : M_INTRO);
  const sim = useSharedValue<LampSim>(restingSim(-999, -999));
  const target = useSharedValue({ x: -999, y: -999 });
  const wick = useSharedValue({ x: -999, y: -999 });
  const autoT = useSharedValue(0);
  const path = useSharedValue<PathPoint[]>([]);
  const pathEnd = useSharedValue(0);
  const marks = useSharedValue<Segment[]>([]);
  const lit = useSharedValue<number[]>([]);
  const dragging = useSharedValue(false);
  const lastTouch = useSharedValue(0);
  const rest = useSharedValue({ x: 0, y: 0 });
  const pathStart = useSharedValue({ x: 0, y: 0 });
  // Deslizes (até o começo do caminho, até o descanso): de onde e quando começou.
  const glideFrom = useSharedValue({ x: 0, y: 0 });
  const glideAt = useSharedValue(0);
  const geom = useSharedValue({ lox: 0, loy: 0, wox: 0, woy: 0, W: 0, H: 0 });
  const ignite = useSharedValue(still ? 1 : 0);
  const dawn = useSharedValue(still ? 1 : 0);
  const refIn = useSharedValue(still ? 1 : 0);
  const titleIn = useSharedValue(still ? 1 : 0);
  const ctaIn = useSharedValue(still ? 1 : 0);
  const hintIn = useSharedValue(0);
  const amount = still ? 0.12 : 1;

  const ready = !!screen && !!para && !!spacer && lines !== null;

  // Geometria para a thread de UI (muda só com o layout).
  useEffect(() => {
    if (!ready || !para || !spacer) return;
    geom.value = { lox: lightOff.x, loy: lightOff.y, wox: wickOff.x, woy: wickOff.y, W, H };
    const scenePath = planPath(
      vis.map((l) => ({ ...l, x: l.x + para.x, y: l.y + para.y })),
      { rtl },
    );
    path.value = scenePath;
    pathEnd.value = pathDuration(scenePath);
    marks.value = segs.map((s) => ({ ...s, x0: s.x0 + para.x, x1: s.x1 + para.x, cx: s.cx + para.x, cy: s.cy + para.y }));
    if (lit.value.length !== segs.length) lit.value = segs.map(() => (still ? 1 : 0));
    rest.value = { x: W / 2, y: spacer.y + spacer.height * 0.5 };
    // Começo do caminho, no sistema da candeia (ponto de apoio).
    const begin = scenePath.length ? { x: scenePath[0]!.x - lightOff.x, y: scenePath[0]!.y - lightOff.y } : rest.value;
    pathStart.value = begin;
    // Primeira medida: a candeia acende perto do começo do caminho, mas inteira na tela (no começo da linha ela
    // ficaria meio para fora); ou já no descanso, se a cena começa parada.
    if (sim.value.x < -900) {
      const margin = lw / 2 + 10;
      const start = still ? rest.value : { x: Math.min(W - margin, Math.max(margin, begin.x)), y: begin.y };
      sim.value = restingSim(start.x, start.y);
      target.value = start;
      glideFrom.value = start;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, para, spacer, segs, vis, W, H, lw, rtl, still]);

  // ---- fases ------------------------------------------------------------------------------------------
  const startAuto = useCallback(() => setPhase((p) => (p === 'intro' ? 'auto' : p)), []);
  const finish = useCallback(() => {
    setPhase((p) => (p === 'done' ? p : 'done'));
  }, []);

  // Acender e começar o caminho.
  useEffect(() => {
    if (!ready || still || phase !== 'intro') return;
    ignite.value = withDelay(IGNITE_DELAY, withTiming(1, { duration: IGNITE_MS, easing: EASE_IGNITE }));
    // Acesa, a candeia desliza até o começo da primeira linha e começa a ler.
    const t = setTimeout(() => {
      if (mode.value === M_INTRO) {
        glideFrom.value = { x: sim.value.x, y: sim.value.y };
        glideAt.value = clock.value;
        mode.value = M_APPROACH;
      }
    }, IGNITE_DELAY + IGNITE_MS * 0.85);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, still]);

  // Dica: aparece discreta se o leitor ainda não tocou.
  useEffect(() => {
    if (phase === 'auto') hintIn.value = withDelay(2600, withTiming(1, { duration: 900 }));
    else hintIn.value = withTiming(0, { duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Fim: a escuridão recua, a referência aparece, o título sobe e depois o botão.
  useEffect(() => {
    if (phase !== 'done' || still) return;
    dawn.value = withTiming(1, { duration: 2400, easing: EASE_IN_OUT });
    refIn.value = withDelay(900, withTiming(1, { duration: 1100, easing: EASE_OUT }));
    titleIn.value = withDelay(1500, withTiming(1, { duration: 1500, easing: EASE_OUT }));
    ctaIn.value = withDelay(2500, withTiming(1, { duration: 900, easing: EASE_OUT }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, still]);

  // Cena parada (inclusive quando o leitor de tela é detectado depois de montar): tudo aceso e no lugar.
  useEffect(() => {
    if (!still) return;
    setPhase('done');
    mode.value = M_REST;
    for (const v of [ignite, dawn, refIn, titleIn, ctaIn]) v.value = 1;
    lit.value = lit.value.map(() => 1);
    glideAt.value = -10;
    glideFrom.value = rest.value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  // ---- quadro a quadro --------------------------------------------------------------------------------
  useFrameCallback((f) => {
    const dt = Math.min(0.05, (f.timeSincePreviousFrame ?? 16) / 1000);
    clock.value += dt;
    const g = geom.value;
    if (g.W === 0) return;
    let m = mode.value;
    let t = target.value;
    if (m === M_AUTO) {
      autoT.value += dt;
      const p = samplePath(path.value, autoT.value);
      t = { x: p.x - g.lox, y: p.y - g.loy };
      target.value = t;
      if (autoT.value > pathEnd.value + 0.3) {
        m = M_REST;
        mode.value = M_REST;
        glideFrom.value = t;
        glideAt.value = clock.value;
        scheduleOnRN(finish);
      }
    } else if (m === M_APPROACH) {
      const u = Math.min(1, Math.max(0, (clock.value - glideAt.value) / 0.9));
      const e = u * u * (3 - 2 * u);
      const a = glideFrom.value;
      const b = pathStart.value;
      t = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      target.value = t;
      if (u >= 1) {
        autoT.value = 0;
        mode.value = M_AUTO;
        scheduleOnRN(startAuto);
      }
    } else if (m === M_REST) {
      // Desliza até o descanso, devagar, sem pressa de chegar.
      const u = Math.min(1, Math.max(0, (clock.value - glideAt.value) / 2.2));
      const e = u * u * u * (u * (u * 6 - 15) + 10);
      const a = glideFrom.value;
      const b = rest.value;
      t = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      target.value = t;
    } else if (m === M_USER && !dragging.value && clock.value - lastTouch.value > IDLE_FINISH) {
      mode.value = M_REST;
      glideFrom.value = t;
      glideAt.value = clock.value;
      scheduleOnRN(finish);
    }
    const s = stepLamp(sim.value, t.x, t.y, dt);
    sim.value = s;
    const th = (s.tilt * Math.PI) / 180;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const wx = s.x + c * g.wox - sn * g.woy;
    const wy = s.y + sn * g.wox + c * g.woy;
    wick.value = { x: wx, y: wy };
    // Palavras alcançadas pela luz.
    if (m === M_AUTO || m === M_USER) {
      const lx = wx;
      const ly = wy - (g.woy - g.loy);
      const ms = marks.value;
      const cur = lit.value;
      let next: number[] | null = null;
      for (let i = 0; i < ms.length; i++) {
        if (cur[i]) continue;
        if (litBy(ms[i]!, lx, ly, MARK_RX, MARK_RY)) {
          if (!next) next = cur.slice();
          next[i] = 1;
        }
      }
      if (next) {
        lit.value = next;
        if (m === M_USER && next.every((v) => v === 1)) {
          mode.value = M_REST;
          glideFrom.value = t;
          glideAt.value = clock.value + 0.6;
          scheduleOnRN(finish);
        }
      }
    }
  });

  // ---- gestos -----------------------------------------------------------------------------------------
  const takeOver = useCallback(() => setPhase((p) => (p === 'done' ? p : 'user')), []);
  const gesture = useMemo(() => {
    const clampTarget = (x: number, y: number) => {
      'worklet';
      const g = geom.value;
      const lx = Math.min(g.W - 12, Math.max(12, x + g.lox));
      const ly = Math.min(g.H - 40, Math.max(24, y + g.loy));
      return { x: lx - g.lox, y: ly - g.loy };
    };
    const assume = () => {
      'worklet';
      const m = mode.value;
      if (m === M_INTRO || m === M_APPROACH || m === M_AUTO) {
        mode.value = M_USER;
        target.value = { x: sim.value.x, y: sim.value.y };
        scheduleOnRN(takeOver);
      } else if (m === M_REST) {
        mode.value = M_FREE;
        target.value = { x: sim.value.x, y: sim.value.y };
      }
    };
    const pan = Gesture.Pan()
      .minDistance(3)
      .onStart(() => {
        assume();
        dragging.value = true;
      })
      .onChange((e) => {
        const t = target.value;
        target.value = clampTarget(t.x + e.changeX, t.y + e.changeY);
        lastTouch.value = clock.value;
      })
      .onFinalize(() => {
        dragging.value = false;
        lastTouch.value = clock.value;
      });
    // Toque: a luz vai até o ponto tocado (o dedo sai e não cobre o texto).
    const tap = Gesture.Tap()
      .maxDuration(300)
      .onEnd((e, ok) => {
        if (!ok || mode.value === M_REST || mode.value === M_FREE) return;
        assume();
        target.value = clampTarget(e.x - geom.value.lox, e.y - geom.value.loy);
        lastTouch.value = clock.value;
      });
    return Gesture.Exclusive(pan, tap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- estilos animados -------------------------------------------------------------------------------
  const veilStyle = useAnimatedStyle(() => {
    const w = wick.value;
    const g = geom.value;
    const d = dawn.value;
    return {
      opacity: 1 - d,
      transform: [{ translateX: w.x - hole.w / 2 }, { translateY: w.y - (g.woy - g.loy) - holeUp - hole.h / 2 }],
    };
  });
  const holeStyle = useAnimatedStyle(() => {
    const f = flicker(clock.value, 0.3, amount);
    const k = (0.94 + 0.06 * f.intensity) * (0.82 + 0.18 * ignite.value) * (1 + dawn.value * 1.4);
    return { transform: [{ scale: k }] };
  });
  // A luz do ambiente vem um pouco atrás da chama (primeiro a chama pega, depois clareia em volta).
  const nightStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.pow(ignite.value, 1.7) * 1.1) }));
  const emberLayer = useAnimatedStyle(() => ({ opacity: 1 - dawn.value }));
  const poolStyle = useAnimatedStyle(() => {
    const w = wick.value;
    const f = flicker(clock.value, 0.3, amount);
    const g = ignite.value;
    const d = dawn.value;
    return {
      opacity: g * (0.78 + 0.22 * f.intensity) * (1 - 0.35 * d),
      transform: [
        { translateX: w.x - pool / 2 },
        { translateY: w.y - flameH * 0.5 - pool / 2 },
        { scale: (0.9 + 0.1 * f.intensity) * (0.6 + 0.4 * g) * (1 + d * 0.9) },
      ],
    };
  });
  const bloomStyle = useAnimatedStyle(() => {
    const w = wick.value;
    const f = flicker(clock.value + 0.05, 0.3, amount);
    return {
      opacity: ignite.value * (0.7 + 0.3 * f.intensity),
      transform: [
        { translateX: w.x - bloom / 2 },
        { translateY: w.y - flameH * 0.45 - bloom / 2 },
        { scale: 0.85 + 0.2 * f.intensity * ignite.value },
      ],
    };
  });
  const lampStyle = useAnimatedStyle(() => {
    const s = sim.value;
    return { transform: [{ translateX: s.x - lw / 2 }, { translateY: s.y - lh / 2 }, { rotate: `${s.tilt}deg` }] };
  });
  // Sombra da própria candeia: o corpo de barro tapa a luz que desceria para as linhas de baixo.
  const shadowStyle = useAnimatedStyle(() => {
    const s = sim.value;
    return {
      opacity: ignite.value * (0.92 - 0.5 * dawn.value),
      transform: [
        { translateX: s.x - shadow.w / 2 },
        { translateY: s.y + lh * 0.12 - shadow.w / 2 },
        { scaleY: shadow.h / shadow.w },
      ],
    };
  });
  const lampBodyStyle = useAnimatedStyle(() => ({ opacity: 0.08 + 0.92 * Math.min(1, ignite.value * 1.4) }));
  const lampLightStyle = useAnimatedStyle(() => {
    const f = flicker(clock.value + 0.03, 0.3, amount);
    return { opacity: ignite.value * Math.min(1, 0.62 + 0.38 * f.intensity * f.intensity) };
  });
  const flameStyle = useAnimatedStyle(() => {
    const w = wick.value;
    return { transform: [{ translateX: w.x - fbox.width / 2 }, { translateY: w.y - fbox.height / 2 }] };
  });
  const refStyle = useAnimatedStyle(() => ({ opacity: refIn.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleIn.value,
    transform: [{ translateY: (1 - titleIn.value) * 22 }],
  }));
  const titleGlow = useAnimatedStyle(() => {
    const f = flicker(clock.value + 0.4, 0.3, amount);
    return { opacity: titleIn.value * (0.85 + 0.15 * f.intensity), transform: [{ scale: 0.7 + 0.3 * titleIn.value }] };
  });
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaIn.value,
    transform: [{ translateY: (1 - ctaIn.value) * 10 }],
  }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: hintIn.value * 0.85 }));

  // ---- medidas do layout --------------------------------------------------------------------------------
  const onRoot = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setScreen((s) => (s && s.w === width && s.h === height ? s : { w: width, h: height }));
  };
  const onPara = (e: LayoutChangeEvent) => {
    const l = e.nativeEvent.layout;
    setPara((p) => (p && p.x === l.x && p.y === l.y && p.width === l.width && p.height === l.height ? p : l));
    if (Platform.OS === 'web') {
      // Na web não há onTextLayout: mede no DOM depois da pintura.
      requestAnimationFrame(() => setLines(linesFromDom(textRef.current)));
    }
  };
  const onTextLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => setLines(linesFromNative(e.nativeEvent.lines));
  const onSpacer = (e: LayoutChangeEvent) => setSpacer(e.nativeEvent.layout);

  const done = phase === 'done';
  const titleSize = 46;

  return (
    <GestureDetector gesture={gesture}>
      <View testID={testID} style={{ flex: 1, backgroundColor: night.dark, overflow: 'hidden' }} onLayout={onRoot}>
        <View style={{ flex: 1.15 }} />

        <View style={{ marginHorizontal: 34 }} onLayout={onPara}>
          <Text
            ref={textRef}
            testID={testID ? `${testID}-verse` : undefined}
            style={[vStyle, dir, { color: night.lit }]}
            {...(Platform.OS === 'web' ? null : { onTextLayout })}
          >
            {verse}
          </Text>
        </View>

        {screen && (
          <>
            {/* Véu: escuridão com o furo de luz. */}
            <Animated.View style={[abs, veilStyle]} pointerEvents="none">
              <VeilFrame w={hole.w} h={hole.h} reach={reach} color={night.dark}>
                <Animated.View style={holeStyle}>
                  <VeilHole w={hole.w} h={hole.h} color={night.dark} />
                </Animated.View>
              </VeilFrame>
            </Animated.View>

            {/* Brasas: o que a luz já tocou continua visível, de leve. */}
            {para && lines && (
              <Animated.View
                style={[abs, { left: para.x, top: para.y, width: para.width, height: para.height }, emberLayer]}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                aria-hidden
              >
                {segs.map((s, i) => (
                  <Ember key={i} index={i} seg={s} line={vis[s.line]!} width={para.width} lit={lit} style={[vStyle, dir]} />
                ))}
              </Animated.View>
            )}

            <Animated.View style={[abs, { width: shadow.w, height: shadow.w }, shadowStyle]} pointerEvents="none">
              <RadialLight id="candeiaShadow" size={shadow.w} color={night.dark} falloff="halo" />
            </Animated.View>

            {/* Antes de acender: noite fechada. */}
            <Animated.View style={[abs, { width: W, height: H, backgroundColor: night.dark }, nightStyle]} pointerEvents="none" />

            {/* Ar aquecido em volta da chama. */}
            <Animated.View style={[abs, poolStyle]} pointerEvents="none">
              <RadialLight id="candeiaPool" size={pool} color={light.pool} opacity={0.32} falloff="pool" />
            </Animated.View>

            <View style={[abs]} pointerEvents="none">
              <Vignette w={W} h={H} color={night.vignette} />
            </View>

            {/* Candeia. */}
            <Animated.View style={[abs, { width: lw, height: lh }, lampStyle]} pointerEvents="none">
              <View style={{ width: lw, height: lh, transform: [{ scaleX: mirror }] }}>
                <Animated.View style={[abs, lampBodyStyle]}>
                  <LampBody width={lw} />
                </Animated.View>
                <Animated.View style={[abs, lampLightStyle]}>
                  <LampLight width={lw} />
                </Animated.View>
              </View>
            </Animated.View>

            <Animated.View style={[abs, bloomStyle]} pointerEvents="none">
              <RadialLight id="candeiaBloom" size={bloom} color={light.bloom} core={light.hot} opacity={0.5} falloff="bloom" />
            </Animated.View>
            <Animated.View style={[abs, flameStyle]} pointerEvents="none">
              <LiveFlame height={flameH} clock={clock} sim={sim} ignite={ignite} amount={amount} />
            </Animated.View>
          </>
        )}

        <Animated.View style={[{ marginTop: 22, marginHorizontal: 34 }, refStyle]}>
          <Text style={[refText, dir, { textAlign: 'center' }]}>{reference}</Text>
        </Animated.View>

        <View style={{ flex: 1 }} onLayout={onSpacer} />

        <Animated.View style={[{ alignItems: 'center' }, titleStyle]}>
          <Animated.View
            style={[abs, { top: (titleSize * 1.2) / 2 - 150, left: '50%', marginLeft: -150 }, titleGlow]}
            pointerEvents="none"
          >
            <RadialLight id="candeiaTitle" size={300} color={night.gold} opacity={0.16} falloff="halo" />
          </Animated.View>
          <Text style={[titleText, { fontSize: titleSize, lineHeight: titleSize * 1.2 }]} accessibilityRole="header">
            {title}
          </Text>
        </Animated.View>

        <Animated.View style={[{ alignItems: 'center', marginTop: 26 }, ctaStyle]} pointerEvents={done ? 'auto' : 'none'}>
          <Pressable
            testID={testID ? `${testID}-continue` : undefined}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            accessibilityElementsHidden={!done}
            importantForAccessibility={done ? 'auto' : 'no-hide-descendants'}
            disabled={!done}
            onPress={onContinue}
            hitSlop={8}
            style={({ pressed }) => [ctaBox, { backgroundColor: pressed ? night.goldWashPressed : night.goldWash }]}
          >
            <Text style={ctaText}>{ctaLabel}</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[{ height: 44, justifyContent: 'center', marginTop: 10 }, hintStyle]} pointerEvents="none">
          <Text style={[hintText, dir, { textAlign: 'center' }]}>{hint}</Text>
        </Animated.View>
        <View style={{ height: insets.bottom + 18 }} />
      </View>
    </GestureDetector>
  );
}

/** Trecho de linha que guarda brilho depois que a luz passou: a mesma linha, recortada na janela da palavra. */
function Ember({
  index,
  seg,
  line,
  width,
  lit,
  style,
}: {
  index: number;
  seg: Segment;
  line: TextLine;
  width: number;
  lit: SharedValue<number[]>;
  style: TextStyle[];
}) {
  const o = useSharedValue(0);
  useAnimatedReaction(
    () => lit.value[index] ?? 0,
    (v, prev) => {
      if (v === 1 && prev !== 1) {
        // Acende forte junto com a luz e assenta num brilho de brasa.
        o.value = withSequence(withTiming(1, { duration: 380 }), withTiming(EMBER, { duration: 1600 }));
      }
    },
  );
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  const pad = 8;
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: seg.x0, top: line.y - pad, width: seg.x1 - seg.x0, height: line.height + 2 * pad, overflow: 'hidden' },
        st,
      ]}
    >
      {/* Caixa da largura do parágrafo (sem numberOfLines: na web ele limita a largura à da janela). */}
      <View style={{ position: 'absolute', left: -seg.x0, top: pad, width }}>
        <Text style={[...style, { color: night.ember }]}>{line.text.trim()}</Text>
      </View>
    </Animated.View>
  );
}

const abs = { position: 'absolute', left: 0, top: 0 } as const;

const refText: TextStyle = {
  fontFamily: fontFamilies.uiSemibold,
  fontSize: 12.5,
  lineHeight: 18,
  letterSpacing: 1.6,
  textTransform: 'uppercase',
  color: night.dim,
};
const titleText: TextStyle = {
  fontFamily: fontFamilies.readMedium,
  letterSpacing: 2.5,
  color: night.title,
  textShadowColor: night.titleGlow,
  textShadowRadius: 9,
  textShadowOffset: { width: 0, height: 0 },
};
const ctaBox = {
  minWidth: 180,
  height: 52,
  paddingHorizontal: 36,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: night.gold,
  alignItems: 'center',
  justifyContent: 'center',
} as const;
const ctaText: TextStyle = {
  fontFamily: fontFamilies.uiSemibold,
  fontSize: 16,
  letterSpacing: 0.4,
  color: night.title,
};
const hintText: TextStyle = {
  fontFamily: fontFamilies.ui,
  fontSize: 13.5,
  lineHeight: 19,
  color: night.dim,
};
