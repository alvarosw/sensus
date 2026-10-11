// Modal global: "Sua conexão com o ChatGPT precisa de atenção". Aberto por openChatGPTAttention (sem chave de API).
import { Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Txt, useTheme } from '@/design';
import { FormButton } from '@/features/common/Buttons';
import { useAttention, type AttentionReason } from './attention';

const COPY: Record<AttentionReason, string> = {
  reauth:
    'Sua sessão com o ChatGPT expirou ou foi recusada. Entre de novo nas Configurações para voltar a usar o plano. Enquanto isso, o Sensus não usa sua chave de API nessas perguntas.',
  not_eligible:
    'Esta conta do ChatGPT não tem o plano para o Sensus (requer Go, Plus ou Pro). Nas Configurações, tente o plano de novo ou desconecte. Enquanto isso, o Sensus não usa sua chave de API nessas perguntas.',
};

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
            <Txt v="lensTitle">Sua conexão com o ChatGPT precisa de atenção</Txt>
            <Txt v="bodySm" color="muted" testID="attention-reason">{reason ? COPY[reason] : ''}</Txt>
            <View style={{ gap: 8 }}>
              <FormButton testID="attention-open-settings" label="Abrir Configurações" onPress={openSettings} />
              <FormButton testID="attention-later" variant="secondary" label="Agora não" onPress={dismiss} />
            </View>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
