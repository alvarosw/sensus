// Aviso temporário sob a barra superior (proto: .toast). Lê useStudy().toast; some sozinho em 4 s.
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, interpolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, radius, size, Txt, useTheme } from '@/design';
import { useStudy } from '@/state/study';
import { useLast, usePresence } from './motion';

const AUTO_HIDE_MS = 4000;

export function ToastHost() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useStudy((s) => s.toast);
  const showToast = useStudy((s) => s.showToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => {
      if (useStudy.getState().toast === toast) showToast(null);
    }, AUTO_HIDE_MS);
    return () => clearTimeout(id);
  }, [toast, showToast]);

  const shown = useLast(toast);
  const { progress, mounted } = usePresence(toast !== null, motion.fade);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-12, 0]) }],
  }));

  if (!shown || !mounted) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 15 }]}>
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, top: insets.top + size.topBar + 12, alignItems: 'center' }}
      >
        <Animated.View
          testID="toast"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          pointerEvents={toast !== null ? 'auto' : 'none'}
          style={[
            {
              maxWidth: '90%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: c.text,
              borderRadius: radius.lg,
              paddingHorizontal: 12,
              paddingVertical: 8,
            },
            style,
          ]}
        >
          <Txt v="meta" tint={c.bg} style={{ fontSize: 12.5, lineHeight: 17, flexShrink: 1 }}>
            {shown.text}
          </Txt>
          {shown.actionLabel ? (
            <Pressable
              testID="toast-action"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                shown.onAction?.();
                showToast(null);
              }}
            >
              <Txt v="meta" tint={c.highlight} bold style={{ fontSize: 12.5 }}>
                {shown.actionLabel}
              </Txt>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}
