// Modal global: "Sua conexão com o ChatGPT precisa de atenção". Aberto por openChatGPTAttention (sem chave de API).
import { Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Txt, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { t } from '@/i18n';
import { useAttention, type AttentionReason } from './attention';

/** Motivo do aviso no idioma do app (lido ao renderizar, não na carga do módulo). */
function copyOf(reason: AttentionReason): string {
  return reason === 'reauth' ? t('attention.reauth') : t('attention.notEligible');
}

export function AttentionModal() {
  const { c } = useTheme();
  const reason = useAttention((s) => s.reason);
  const dismiss = useAttention((s) => s.dismiss);
  const visible = reason !== null;

  const openSettings = () => {
    dismiss();
    router.navigate('/settings');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <Pressable
        testID="attention-backdrop"
        accessibilityRole="none"
        onPress={dismiss}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}
      >
        <Pressable accessibilityRole="alert" onPress={() => undefined} testID="attention-modal">
          <Card style={{ gap: 14, backgroundColor: c.surface }}>
            <Txt v="lensTitle">{t('attention.title')}</Txt>
            <Txt v="bodySm" color="muted" testID="attention-reason">{reason ? copyOf(reason) : ''}</Txt>
            <View style={{ gap: 8 }}>
              <FormButton testID="attention-open-settings" label={t('attention.openSettings')} onPress={openSettings} />
              <FormButton testID="attention-later" variant="secondary" label={t('attention.later')} onPress={dismiss} />
            </View>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
