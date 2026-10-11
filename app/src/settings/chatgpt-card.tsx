// Cartão ChatGPT (primeiro item do Assistente): estado, frases e ações. Textos e regras de estado em
// ai-status.ts (chatgptView); aqui ficam só as ações, que chamam o contexto de Configurações.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LLMError, SiwcError, siwcErrorMessage, type ChatGPTModel } from '@sensus/core';
import { Card, Pill, StatusPill, Txt, useTheme } from '@/design';
import { FormButton } from '@/features/common/Buttons';
import { ChatGPTNativeUnavailableError } from '@/auth/chatgpt/loopback';
import { cancelChatGPTSignIn, listChatGPTModels, setChatGPTModel, SignInCancelledError } from '@/auth/chatgpt/service';
import { useSettings } from './settings-context';
import { chatgptView, type ChatGPTAction } from './ai-status';
import { useAiSnapshot } from './use-ai-snapshot';
import { SETTINGS_COPY as COPY } from './strings';

type Notice = { tone: 'ok' | 'error' | 'info'; text: string } | null;

function errorText(e: unknown): string {
  if (e instanceof ChatGPTNativeUnavailableError) return COPY.unavailable;
  if (e instanceof SiwcError) return siwcErrorMessage(e);
  if (e instanceof LLMError) return e.message;
  return COPY.failed;
}

export function ChatGPTCard() {
  const { c } = useTheme();
  const { chatgpt, resumeChatGPT } = useSettings();
  const snap = useAiSnapshot();
  const view = chatgptView(snap);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [models, setModels] = useState<ChatGPTModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const account = chatgpt.account;

  // Sair da tela com o login aberto para o listener (e a aba fica sem retorno).
  useEffect(() => () => cancelChatGPTSignIn(), []);

  const signIn = async (reconsent: boolean) => {
    setBusy(true);
    setSigningIn(true);
    setNotice(null);
    try {
      await chatgpt.signIn({ reconsent });
      setNotice(null);
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

  const retryPlan = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await chatgpt.retryPlan();
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

  const run = (action: ChatGPTAction) => {
    if (action === 'signIn' || action === 'reconnect') return signIn(false);
    if (action === 'grant') return signIn(true);
    if (action === 'retryPlan') return retryPlan();
    if (action === 'resumeChatGPT') return resumeChatGPT();
    return signOut();
  };

  const disabledByNative = !chatgpt.available;

  return (
    <Card testID="chatgpt-card" style={{ gap: 12, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Txt v="lensTitle" style={{ fontSize: 17, lineHeight: 22 }}>{COPY.chatgptTitle}</Txt>
        {view.pill ? <StatusPill label={view.pill.label} tone={view.pill.tone} testID="chatgpt-status" /> : null}
      </View>

      <View style={{ gap: 4 }}>
        {view.lines.map((l, i) => (
          <Txt
            key={i}
            v="bodySm"
            color={l.muted ? 'muted' : 'text'}
            tint={l.warn ? c.warnText : undefined}
            bold={!!l.warn}
          >
            {l.text}
          </Txt>
        ))}
      </View>

      {disabledByNative ? (
        <Txt v="meta" color="muted" testID="chatgpt-unavailable">{COPY.unavailable}</Txt>
      ) : null}

      {view.models ? (
        <View testID="chatgpt-models" style={{ gap: 8 }}>
          <Txt v="eyebrow" color="muted">{COPY.chatgptModel}{account?.model ? `: ${account.model}` : ''}</Txt>
          {models.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {models.slice(0, 25).map((m) => (
                <Pill
                  key={m.slug}
                  testID={`chatgpt-model-${m.slug}`}
                  label={m.displayName}
                  variant={m.slug === account?.model ? 'suggest' : 'default'}
                  onPress={() => pickModel(m.slug)}
                />
              ))}
            </View>
          ) : null}
          <FormButton
            testID="chatgpt-models-load"
            variant="secondary"
            label={loadingModels ? COPY.loadingModels : COPY.loadModels}
            disabled={loadingModels || busy}
            onPress={loadModels}
          />
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        {view.actions.map((a) => {
          const isSignIn = a.action === 'signIn' || a.action === 'reconnect' || a.action === 'grant';
          const label = signingIn && isSignIn ? COPY.signingIn : a.label;
          return (
            <FormButton
              key={a.action}
              testID={`chatgpt-action-${a.action}`}
              variant={a.variant}
              label={label}
              disabled={busy || (isSignIn && disabledByNative)}
              onPress={() => run(a.action)}
            />
          );
        })}
        {signingIn ? (
          <FormButton testID="chatgpt-cancel" variant="secondary" label={COPY.cancel} onPress={() => cancelChatGPTSignIn()} />
        ) : null}
      </View>

      {notice && notice.text ? (
        <Txt v="bodySm" tint={notice.tone === 'ok' ? c.srcText : notice.tone === 'info' ? c.muted : c.danger} testID="chatgpt-notice">
          {notice.text}
        </Txt>
      ) : null}
    </Card>
  );
}
