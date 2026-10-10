// Bolinha flutuante do chat (proto: .bubble): arrastável para qualquer borda, três pontos enquanto a resposta
// é escrita com o chat fechado, contador vermelho de respostas novas.
import { useCallback, useEffect } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { fontFamilies, Icon, motion, shadow, size, useTheme } from '@/design';
import { useStudy } from '@/state/study';
import { EASE, usePresence } from '../common/motion';
import { CHAT } from '../common/strings';
import { bubbleLeft, BUBBLE_MARGIN, clampBottom, minBottom, type Metrics } from './geometry';

export function Bubble({ metrics }: { metrics: Metrics }) {
  const chatOpen = useStudy((s) => s.chatOpen);
  const hasSelection = useStudy((s) => s.selection !== null);
  const hasThread = useStudy((s) => s.thread.length > 0);
  const show = !chatOpen && (hasSelection || hasThread);
  const { progress, mounted } = usePresence(show, motion.fade);
  if (!mounted) return null;
  return <BubbleView metrics={metrics} progress={progress} interactive={show} />;
}

function BubbleView({
  metrics,
  progress,
  interactive,
}: {
  metrics: Metrics;
  progress: ReturnType<typeof usePresence>['progress'];
  interactive: boolean;
}) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const detent = useStudy((s) => s.detent);
  const bubble = useStudy((s) => s.bubble);
  const unread = useStudy((s) => s.unread);
  const typing = useStudy((s) => s.thread.some((t) => t.status === 'streaming'));
  const setBubble = useStudy((s) => s.setBubble);
  const openChat = useStudy((s) => s.openChat);

  const targetLeft = bubbleLeft(bubble.side, metrics);
  const targetBottom = clampBottom(bubble.bottom, detent, metrics);
  const x = useSharedValue(targetLeft);
  const y = useSharedValue(targetBottom);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (dragging.value) return;
    const duration = reduce ? 0 : motion.sheet;
    x.value = withTiming(targetLeft, { duration: reduce ? 0 : 250, easing: EASE });
    y.value = withTiming(targetBottom, { duration, easing: EASE });
  }, [targetLeft, targetBottom, reduce, x, y, dragging]);

  const commit = useCallback(
    (side: 'left' | 'right', bottom: number) => setBubble({ side, bottom }),
    [setBubble],
  );

  const { width, height } = metrics;
  const floor = minBottom(detent, metrics);
  const ceiling = height - 130;
  const pan = Gesture.Pan()
    .minDistance(6)
    .enabled(interactive)
    .onStart(() => {
      sx.value = x.value;
      sy.value = y.value;
      dragging.value = true;
    })
    .onUpdate((e) => {
      x.value = sx.value + e.translationX;
      y.value = sy.value - e.translationY;
    })
    .onEnd(() => {
      const side: 'left' | 'right' = x.value + size.bubble / 2 < width / 2 ? 'left' : 'right';
      const bottom = Math.max(floor, Math.min(ceiling, y.value));
      x.value = withTiming(side === 'left' ? BUBBLE_MARGIN : width - BUBBLE_MARGIN - size.bubble, { duration: 250, easing: EASE });
      y.value = withTiming(bottom, { duration: 250, easing: EASE });
      scheduleOnRN(commit, side, bottom);
    })
    .onFinalize(() => {
      dragging.value = false;
    });
  const tap = Gesture.Tap()
    .maxDuration(10000)
    .enabled(interactive)
    .onEnd((_e, success) => {
      if (success) scheduleOnRN(openChat);
    });
  const gesture = Gesture.Race(pan, tap);

  const style = useAnimatedStyle(() => ({
    left: x.value,
    bottom: y.value,
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.4, 1]) }],
  }));

  const label = unread > 0 ? CHAT.unread(unread) : CHAT.openBubble;
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID="bubble"
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        onAccessibilityTap={openChat}
        pointerEvents={interactive ? 'auto' : 'none'}
        style={[
          {
            position: 'absolute',
            width: size.bubble,
            height: size.bubble,
            borderRadius: size.bubble / 2,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadow.bubble,
          },
          style,
        ]}
      >
        {typing ? <TypingDots color={c.accentText} /> : <Icon name="chat" size={24} color={c.accentText} />}
        {unread > 0 ? (
          <View
            testID="bubble-badge"
            style={{
              position: 'absolute',
              top: -5,
              right: -5,
              padding: 2,
              borderRadius: 12,
              backgroundColor: c.bg,
            }}
          >
            <View
              style={{
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                paddingHorizontal: 5,
                backgroundColor: c.danger,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontFamily: fontFamilies.uiBold, fontSize: 11, lineHeight: 14 }}>{unread}</Text>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

function TypingDots({ color }: { color: string }) {
  return (
    <View testID="bubble-typing" style={{ flexDirection: 'row', gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 150} color={color} />
      ))}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })), -1));
    return () => cancelAnimation(v);
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 1], [1, 0.6]),
    transform: [{ translateY: interpolate(v.value, [0, 1], [0, -3]) }],
  }));
  return <Animated.View style={[{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color }, style]} />;
}
