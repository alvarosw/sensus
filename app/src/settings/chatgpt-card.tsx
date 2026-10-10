// Cartão principal de Configurações: entrar com o ChatGPT (plano), status do plano, modelo e saída.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LLMError, SiwcError, siwcErrorMessage, type ChatGPTModel } from '@sensus/core';
import { Card, Pill, Txt, useTheme } from '@/design';
import { FormButton } from '@/features/common/Buttons';
import { ChatGPTNativeUnavailableError } from '@/auth/chatgpt/loopback';
import { cancelChatGPTSignIn, listChatGPTModels, setChatGPTModel, SignInCancelledError } from '@/auth/chatgpt/service';
import { useSettings } from './settings-context';

const COPY = {
  title: 'Entrar com ChatGPT',
  intro:
    'Use o plano do ChatGPT (Go, Plus ou Pro) nas perguntas do Sensus. As credenciais ficam só neste aparelho, no armazenamento seguro.',
  unavailable: 'Disponível no app instalado (build de desenvolvimento).',
  signIn: 'Entrar com ChatGPT',
  signingIn: 'Entrando…',
  cancel: 'Cancelar',
  cancelled: 'Login cancelado.',
  signedOut: 'Sessão encerrada neste aparelho. Entre de novo para usar o plano.',
  planActive: 'Plano: ativo',
  planNotEligible: 'Plano: não elegível. Requer Go, Plus ou Pro. Usando sua chave de API, se houver.',
  planPermission: 'Plano: permissão não concedida. Libere o uso do plano para o Sensus.',
  retryPlan: 'Tentar o plano de novo',
  grantPlan: 'Liberar o plano',
  loadModels: 'Carregar modelos',
  loadingModels: 'Carregando…',
  model: 'Modelo',
  signOut: 'Sair',
  signedOutOk: 'Sessão encerrada.',
  notRevoked: 'Não foi possível revogar agora. Desconecte o Sensus em ChatGPT > Configurações.',
  failed: 'Não foi possível concluir. Tente de novo.',
};

type Notice = { tone: 'ok' | 'error' | 'info'; text: string } | null;

function errorText(e: unknown): string {
  if (e instanceof ChatGPTNativeUnavailableError) return COPY.unavailable;
  if (e instanceof SiwcError) return siwcErrorMessage(e);
  if (e instanceof LLMError) return e.message;
  return COPY.failed;
}

export function ChatGPTCard() {
  const { c } = useTheme();
  const { chatgpt } = useSettings();
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [models, setModels] = useState<ChatGPTModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const account = chatgpt.account;
  const hasSession = !!account?.hasSession;

  // Sair da tela com o login aberto para o listener (e a aba fica sem retorno).
  useEffect(() => () => cancelChatGPTSignIn(), []);

  const signIn = async (reconsent: boolean) => {
    setBusy(true);
    setSigningIn(true);
    setNotice(null);
    try {
      await chatgpt.signIn({ reconsent });
      setNotice({ tone: 'ok', text: COPY.planActive });
    } catch (e) {
      if (e instanceof SignInCancelledError) setNotice({ tone: 'info', text: COPY.cancelled });
      else setNotice({ tone: 'error', text: errorText(e) });
    } finally {
      setSigningIn(false);
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const { revoked } = await chatgpt.signOut();
      setModels([]);
      setNotice(revoked ? { tone: 'ok', text: COPY.signedOutOk } : { tone: 'error', text: COPY.notRevoked });
    } catch (e) {
      setNotice({ tone: 'error', text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const loadModels = async () => {
    setLoadingModels(true);
    setNotice(null);
    try {
      setModels(await listChatGPTModels());
    } catch (e) {
      setModels([]);
      setNotice({ tone: 'error', text: errorText(e) });
    } finally {
      setLoadingModels(false);
    }
  };

  const pickModel = async (slug: string) => {
    await setChatGPTModel(slug);
    await chatgpt.reload();
  };

  let status: string;
  if (!account || !hasSession) status = COPY.signedOut;
  else if (account.planBlocked) status = COPY.planNotEligible;
  else if (!account.planEnabled) status = COPY.planPermission;
  else status = COPY.planActive;

  return (
    <Card testID="chatgpt-card" style={{ gap: 12 }}>
      <Txt v="lensTitle">{COPY.title}</Txt>
      <Txt v="bodySm">{COPY.intro}</Txt>

      {!chatgpt.available ? (
        <Txt v="meta" color="muted" testID="chatgpt-unavailable">{COPY.unavailable}</Txt>
      ) : null}

      {account ? (
        <View style={{ gap: 4 }}>
          {account.email ? <Txt v="meta" color="muted">{account.email}</Txt> : null}
          <Txt v="bodySm" tint={chatgpt.planActive ? c.srcText : c.muted} testID="chatgpt-status">{status}</Txt>
        </View>
      ) : null}

      {!hasSession ? (
        <FormButton
          testID="chatgpt-signin"
          label={signingIn ? COPY.signingIn : COPY.signIn}
          disabled={busy || !chatgpt.available}
          onPress={() => signIn(false)}
        />
      ) : null}

      {signingIn ? (
        <FormButton testID="chatgpt-cancel" variant="secondary" label={COPY.cancel} onPress={() => cancelChatGPTSignIn()} />
      ) : null}

      {hasSession && account?.planBlocked ? (
        <FormButton testID="chatgpt-retry" variant="secondary" label={COPY.retryPlan} disabled={busy} onPress={() => chatgpt.retryPlan()} />
      ) : null}

      {hasSession && account && !account.planEnabled ? (
        <FormButton testID="chatgpt-grant" variant="secondary" label={COPY.grantPlan} disabled={busy || !chatgpt.available} onPress={() => signIn(true)} />
      ) : null}

      {hasSession && chatgpt.planActive ? (
        <View style={{ gap: 8 }}>
          <Txt v="eyebrow" color="muted">{COPY.model}{account?.model ? `: ${account.model}` : ''}</Txt>
          {models.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {models.slice(0, 25).map((m) => (
                <Pill
                  key={m.slug}
                  testID={`chatgpt-model-${m.slug}`}
                  label={m.displayName}
                  variant={m.slug === account.model ? 'suggest' : 'default'}
                  onPress={() => pickModel(m.slug)}
                />
              ))}
            </View>
          ) : null}
          <FormButton
            testID="chatgpt-models"
            variant="secondary"
            label={loadingModels ? COPY.loadingModels : COPY.loadModels}
            disabled={loadingModels || busy}
            onPress={loadModels}
          />
        </View>
      ) : null}

      {hasSession ? (
        <FormButton testID="chatgpt-signout" variant="ghost" label={COPY.signOut} disabled={busy} onPress={signOut} />
      ) : null}

      {notice ? (
        <Txt v="bodySm" tint={notice.tone === 'ok' ? c.srcText : notice.tone === 'info' ? c.muted : c.danger} testID="chatgpt-notice">{notice.text}</Txt>
      ) : null}
    </Card>
  );
}
