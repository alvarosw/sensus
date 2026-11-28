// Prévia de copiar e compartilhar (docs/design/1a-copiar-compartilhar.html): o texto exato que vai sair, a chave
// "Números dos versículos" (trecho) e os dois botões. Copiar usa a área de transferência e mostra o aviso
// "Copiado · <ref>"; Compartilhar abre a folha do sistema. Camada sobre a folha de estudo, abaixo do aviso.
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { IconButton, Txt, motion, radius, shadow, space, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { currentBcp47 } from '@/i18n';
import { useAppPrefs } from '@/settings/app-prefs';
import { useStudy } from '@/state/study';
import { BACK_PRIORITY, useBackLayer } from '@/features/common/back';
import { useLast, usePresence } from '@/features/common/motion';
import { SHARE } from './strings';
import { useShare, type ShareRequest } from './share-store';
import { useShareText } from './useShareText';

/** Altura máxima da caixa do texto; acima disso, ela rola. */
const PREVIEW_MAX = 230;

export function SharePreview() {
  const { c } = useTheme();
  const request = useShare((s) => s.request);
  const close = useShare((s) => s.close);
  const shown = useLast(request);
  const { progress, mounted } = usePresence(request !== null, motion.sheet);
  useBackLayer('share', request !== null, close, BACK_PRIORITY.popover);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(progress.value, [0, 1], [420, 0]) }] }));

  if (!shown || !mounted) return null;
  return (
    <View pointerEvents={request ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, { zIndex: 14, elevation: 35 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrimStyle]}>
        <Pressable testID="share-scrim" accessibilityRole="button" accessibilityLabel={SHARE.close} onPress={close} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0 }, panelStyle]}>
        <Panel request={shown} onClose={close} />
      </Animated.View>
    </View>
  );
}

function Panel({ request, onClose }: { request: ShareRequest; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const numbers = useAppPrefs((s) => s.shareVerseNumbers);
  const setNumbers = useAppPrefs((s) => s.setShareVerseNumbers);
  const { text, error, title } = useShareText(request);
  const [busy, setBusy] = useState(false);
  const isSynth = request.kind === 'synth';
  const copyFirst = request.kind === 'verses' && request.intent === 'copy';
  const eyebrow = isSynth ? SHARE.synthTitle : copyFirst ? SHARE.copyTitle : SHARE.shareTitle;
  const toast = useStudy.getState().showToast;

  const copy = async () => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
      onClose();
      toast({ text: SHARE.copied(isSynth ? SHARE.synthOf(title) : title) });
    } catch {
      toast({ text: SHARE.copyFailed });
    }
  };
  const share = async () => {
    if (!text || busy) return;
    setBusy(true);
    try {
      await Share.share({ message: text });
      onClose();
    } catch {
      toast({ text: SHARE.shareFailed });
    } finally {
      setBusy(false);
    }
  };

  const copyButton = <FormButton label={SHARE.copy} variant={copyFirst ? 'primary' : 'secondary'} disabled={!text} onPress={copy} testID="share-copy" />;
  const shareButton = (
    <FormButton label={SHARE.shareMore} variant={copyFirst ? 'secondary' : 'primary'} disabled={!text || busy} onPress={share} testID="share-system" />
  );

  return (
    <View
      testID="share-preview"
      accessibilityViewIsModal
      style={[
        { backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: insets.bottom + space[8] },
        shadow.sheet,
      ]}
    >
      <View style={{ height: 22, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: c.border }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[5], paddingHorizontal: space[8], paddingBottom: space[5] }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="eyebrow" color="muted">{eyebrow}</Txt>
          <Txt v="sheetTitle" numberOfLines={2} testID="share-title">{title}</Txt>
        </View>
        <IconButton icon="close" label={SHARE.close} onPress={onClose} testID="share-close" />
      </View>

      <View style={{ paddingHorizontal: space[8], gap: space[5] }}>
        <ScrollView
          testID="share-scroll"
          accessibilityLabel={SHARE.previewLabel}
          style={{ maxHeight: PREVIEW_MAX, backgroundColor: c.surfaceAlt, borderRadius: radius.card }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12 }}
        >
          {text ? (
            <Txt v="body" selectable testID="share-text" style={{ fontSize: 14.5, lineHeight: 22 }}>{text}</Txt>
          ) : (
            <Txt v="bodySm" color={error ? 'danger' : 'muted'}>{error ? SHARE.loadError : SHARE.loading}</Txt>
          )}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[4], marginTop: -space[2] }}>
          <Txt v="meta" color="muted">{SHARE.plainText}</Txt>
          {text ? <Txt v="meta" color="muted">{SHARE.chars(text.length, text.length.toLocaleString(currentBcp47()))}</Txt> : null}
        </View>

        {request.kind === 'verses' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: space[6] }}>
            <Txt v="body" bold style={{ flexShrink: 1 }}>{SHARE.verseNumbers}</Txt>
            <Switch
              testID="share-numbers"
              accessibilityLabel={SHARE.verseNumbers}
              value={numbers}
              onValueChange={setNumbers}
              trackColor={{ false: c.border, true: c.accent }}
              thumbColor={c.surface}
            />
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: space[4] }}>
          <View style={{ flex: 1 }}>{copyFirst ? shareButton : copyButton}</View>
          <View style={{ flex: 1 }}>{copyFirst ? copyButton : shareButton}</View>
        </View>
      </View>
    </View>
  );
}
