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
  planNotEligible: 'Plano: não elegível. Requer Go, Plus ou Pro.',
  planPermission: 'Plano: permissão não concedida. Libere o uso do plano para o Sensus.',
  retryPlan: 'Tentar o plano de novo',
  grantPlan: 'Liberar o plano',
  loadModels: 'Carregar modelos',
  loadingModels: 'Carregando…',
  model: 'Modelo',
  signOut: 'Desconectar ChatGPT',
  reconnect: 'Entrar de novo',
  attentionReauth: 'Sua sessão com o ChatGPT expirou ou foi recusada. Entre de novo para voltar a usar o plano. Enquanto isso, o Sensus não usa sua chave de API nessas perguntas.',
  attentionNotEligible: 'Esta conta do ChatGPT não tem o plano para o Sensus (requer Go, Plus ou Pro). Assine um plano e tente de novo, troque de conta ou desconecte. Enquanto isso, o Sensus não usa sua chave de API nessas perguntas.',
  limitUntil: 'Limite do plano atingido — volta às',
  limitRetry: 'Limite do plano atingido — nova tentativa às',
  limitHint: 'Até lá, as perguntas usam sua chave de API.',
  signedOutOk: 'Sessão encerrada.',
  notRevoked: 'Não foi possível revogar agora. Desconecte o Sensus em ChatGPT > Configurações.',
  failed: 'Não foi possível concluir. Tente de novo.',
};

type Notice = { tone: 'ok' | 'error' | 'info'; text: string } | null;

/** HH:MM no horário do aparelho (sem depender de Intl). */
function clock(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function errorText(e: unknown): string {
  if (e instanceof ChatGPTNativeUnavailableError) return COPY.unavailable;
  if (e instanceof SiwcError) return siwcErrorMessage(e);
  if (e instanceof LLMError) return e.message;
  return COPY.failed;
}

export function ChatGPTCard() {
  const { c } = useTheme();
  const { chatgpt, mode, pause } = useSettings();
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

  const attention = chatgpt.attention;
  let status: string;
  if (!account || !account.connected) status = COPY.signedOut;
  else if (account.planBlocked) status = COPY.planNotEligible;
  else if (!account.planEnabled) status = COPY.planPermission;
  else if (!hasSession) status = COPY.signedOut;
  else status = COPY.planActive;

  // A pausa só se aplica ao modo Automático (no modo Só ChatGPT não há reserva para usar).
  const paused = mode === 'auto' && pause !== null;

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
          {attention ? null : <Txt v="bodySm" tint={chatgpt.planActive ? c.srcText : c.muted} testID="chatgpt-status">{status}</Txt>}
        </View>
      ) : null}

      {attention ? (
        <View testID="chatgpt-attention" style={{ gap: 10 }}>
          <Txt v="bodySm" tint={c.danger} bold>Sua conexão com o ChatGPT precisa de atenção</Txt>
          <Txt v="bodySm">{attention === 'reauth' ? COPY.attentionReauth : COPY.attentionNotEligible}</Txt>
          <FormButton testID="chatgpt-reconnect" label={COPY.reconnect} disabled={busy || !chatgpt.available} onPress={() => signIn(false)} />
        </View>
      ) : null}

      {paused && pause ? (
        <View testID="chatgpt-paused" style={{ gap: 4 }}>
          <Txt v="bodySm" tint={c.danger} testID="chatgpt-paused-text">
            {pause.known ? `${COPY.limitUntil} ${clock(pause.until)}.` : `${COPY.limitRetry} ${clock(pause.until)}.`}
          </Txt>
          <Txt v="meta" color="muted">{COPY.limitHint}</Txt>
        </View>
      ) : null}

      {!hasSession && !attention ? (
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

      {account && account.connected ? (
        <FormButton testID="chatgpt-signout" variant="ghost" label={COPY.signOut} disabled={busy} onPress={signOut} />
      ) : null}

      {notice ? (
        <Txt v="bodySm" tint={notice.tone === 'ok' ? c.srcText : notice.tone === 'info' ? c.muted : c.danger} testID="chatgpt-notice">{notice.text}</Txt>
      ) : null}
    </Card>
  );
}
