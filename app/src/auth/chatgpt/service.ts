// Sign in with ChatGPT no app: login (loopback), troca de código, renovação, saída e listagem de modelos.
// Os textos de erro vêm do núcleo (pt-BR). Nenhum token é registrado em log ou exibido.
import * as WebBrowser from 'expo-web-browser';
import {
  buildAuthorizeUrl,
  buildChatGPTProviderConfig,
  buildCodeExchangeRequest,
  buildRefreshRequest,
  buildRevokeRequest,
  createPkce,
  hasPlanScope,
  LLMError,
  newHostId,
  OpenAIResponsesProvider,
  parseCallback,
  parseTokenResponse,
  randomToken,
  SIWC,
  SiwcError,
  verifyIdToken,
  type HttpRequestSpec,
  type Jwks,
  type ChatGPTModel,
} from '@sensus/core';
import { expoCrypto } from './crypto';
import {
  accountKey,
  getOrCreateHostId,
  readActiveAccount,
  saveAccount,
  setActiveAccount,
  toView,
  updateAccount,
  type ChatGPTAccountView,
  type StoredAccount,
} from './accounts';
import { ChatGPTNativeUnavailableError, isChatGPTNativeAvailable, startLoopbackCallback } from './loopback';

/** Nome enviado no primeiro registro (agent_name_hint). */
const AGENT_NAME = 'Sensus';

/** Usuário fechou o navegador antes de concluir. Não é erro para mostrar em destaque. */
export class SignInCancelledError extends Error {
  constructor() {
    super('Login cancelado.');
    this.name = 'SignInCancelledError';
  }
}

// ---- eventos (Configurações e cliente de IA reagem a mudanças) ----------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeChatGPT(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const l of listeners) l();
}

// ---- JWKS ----------------------------------------------------------------------------------------

const JWKS_TTL_MS = 60 * 60_000;
let jwksCache: { at: number; jwks: Jwks } | null = null;

async function getJwks(): Promise<Jwks> {
  if (jwksCache && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.jwks;
  let res: Response;
  try {
    res = await fetch(SIWC.jwksUrl);
  } catch {
    throw new SiwcError('Sem conexão para verificar a identidade.', 'jwks_unavailable');
  }
  if (!res.ok) throw new SiwcError('Chaves de verificação indisponíveis.', 'jwks_unavailable', res.status);
  const body = (await res.json()) as Partial<Jwks>;
  if (!Array.isArray(body.keys)) throw new SiwcError('Chaves de verificação em formato inesperado.', 'jwks_unavailable');
  const jwks = { keys: body.keys };
  jwksCache = { at: Date.now(), jwks };
  return jwks;
}

// ---- token endpoint ------------------------------------------------------------------------------

/** POST form no endpoint de token. Mensagens nunca incluem o corpo da resposta (pode trazer tokens). */
async function postTokenRequest(spec: HttpRequestSpec, grant: 'authorization_code' | 'refresh_token'): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(spec.url, { method: spec.method, headers: spec.headers, body: spec.body });
  } catch {
    throw new SiwcError('Sem conexão com o ChatGPT.', 'network');
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (res.ok) return json;
  if (res.status >= 500) throw new SiwcError('O ChatGPT está indisponível no momento.', 'server', res.status);
  const err = json && typeof json === 'object' ? (json as { error?: unknown }).error : undefined;
  const code = typeof err === 'string' ? err : '';
  if (code === 'invalid_client') throw new SiwcError('Cliente ChatGPT recusado.', 'invalid_client', res.status);
  if (grant === 'refresh_token' && (code === 'invalid_grant' || code === 'invalid_refresh_token' || code === 'token_expired' || code.startsWith('refresh_token_'))) {
    throw new SiwcError('Sessão do ChatGPT expirada.', 'refresh_invalid', res.status);
  }
  if (code === 'invalid_grant') throw new SiwcError('Código de login inválido ou usado.', 'invalid_grant', res.status);
  throw new SiwcError(`Falha ao obter o token (HTTP ${res.status}).`, 'token_response', res.status);
}

// ---- login ---------------------------------------------------------------------------------------

async function getHostId(): Promise<string> {
  return getOrCreateHostId(() => newHostId(expoCrypto));
}

/**
 * Login completo: sobe o retorno em 127.0.0.1 antes de abrir o navegador, recebe o código, responde a
 * página, fecha o navegador, troca o código e valida o ID token (iss, aud, exp, nonce, assinatura) e os
 * escopos. Sem o escopo do plano, a conta fica salva com plano desligado.
 * Com conta salva, reautoriza com o client_id dela (sem agent_name_hint).
 */
export async function signInWithChatGPT(opts: { reconsent?: boolean } = {}): Promise<StoredAccount> {
  if (!isChatGPTNativeAvailable()) throw new ChatGPTNativeUnavailableError();

  const prior = await readActiveAccount();
  const clientId = prior?.clientId ?? SIWC.dynamicClientId;
  const hostId = await getHostId();
  const pkce = await createPkce(expoCrypto);
  const state = randomToken(expoCrypto);
  const nonce = randomToken(expoCrypto);

  const loopback = await startLoopbackCallback();
  let target: string;
  try {
    const url = buildAuthorizeUrl({
      clientId,
      hostId,
      redirectUri: loopback.redirectUri,
      state,
      nonce,
      codeChallenge: pkce.challenge,
      agentNameHint: clientId === SIWC.dynamicClientId ? AGENT_NAME : undefined,
      loginHint: prior?.email ?? undefined,
      idTokenHint: prior?.idToken ?? undefined,
      reconsent: opts.reconsent,
    });
    target = await new Promise<string>((resolve, reject) => {
      loopback.target.then(resolve, reject);
      WebBrowser.openBrowserAsync(url).then(
        (result) => {
          // Fechou sem concluir: dá uma folga curta, porque o retorno pode estar chegando.
          if (result.type === 'cancel' || result.type === 'dismiss') {
            setTimeout(() => reject(new SignInCancelledError()), 1500);
          }
        },
        reject,
      );
    });
  } finally {
    loopback.close();
  }
  await WebBrowser.dismissBrowser().catch(() => undefined);

  const cb = parseCallback(target, { redirectUri: loopback.redirectUri, state, clientId });
  const json = await postTokenRequest(
    buildCodeExchangeRequest({
      clientId: cb.issuedClientId,
      code: cb.code,
      codeVerifier: pkce.verifier,
      redirectUri: loopback.redirectUri,
    }),
    'authorization_code',
  );
  const nowMs = Date.now();
  const tokens = parseTokenResponse(json, { nowMs, requireIdToken: true });
  const claims = await verifyIdToken(tokens.idToken!, {
    clientId: cb.issuedClientId,
    nowMs,
    nonce,
    jwks: await getJwks(),
    crypto: expoCrypto,
  });

  if (prior && claims.sub !== prior.sub) {
    throw new SiwcError('Esta conta do ChatGPT é diferente da salva. Saia da conta atual antes de trocar.', 'client_id_mismatch');
  }

  const planEnabled = hasPlanScope(tokens.scopes);
  const account: StoredAccount = {
    key: accountKey(cb.issuedClientId, claims.sub),
    clientId: cb.issuedClientId,
    sub: claims.sub,
    email: claims.email ?? prior?.email ?? null,
    hostId,
    scopes: tokens.scopes,
    planEnabled,
    planBlocked: false,
    model: prior?.model ?? '',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    idToken: tokens.idToken,
    expiresAt: tokens.expiresAt,
    signedOut: false,
    savedAt: nowMs,
  };
  await saveAccount(account, true);
  notify();

  if (planEnabled && !account.model) {
    try {
      const models = await listModelInfoFor(account.model);
      if (models[0]) await setChatGPTModel(models[0].slug);
    } catch {
      // Sem modelo por enquanto: a tela pede para escolher depois.
    }
  }
  return (await readActiveAccount()) ?? account;
}

// ---- renovação -----------------------------------------------------------------------------------

const refreshing = new Map<string, Promise<StoredAccount>>();

async function refreshAccount(key: string): Promise<StoredAccount> {
  const pending = refreshing.get(key);
  if (pending) return pending;

  const run = (async (): Promise<StoredAccount> => {
    const acc = await readActiveAccount();
    if (!acc || acc.key !== key || !acc.refreshToken || acc.signedOut) {
      throw new LLMError('Entre com o ChatGPT nas configurações para usar o plano.', 'reauth');
    }
    try {
      const json = await postTokenRequest(
        buildRefreshRequest({ clientId: acc.clientId, refreshToken: acc.refreshToken }),
        'refresh_token',
      );
      const nowMs = Date.now();
      const tokens = parseTokenResponse(json, {
        nowMs,
        fallbackScopes: acc.scopes,
        fallbackRefreshToken: acc.refreshToken,
      });
      if (tokens.idToken) {
        const claims = await verifyIdToken(tokens.idToken, {
          clientId: acc.clientId,
          nowMs,
          jwks: await getJwks(),
          crypto: expoCrypto,
        });
        if (claims.sub !== acc.sub) throw new SiwcError('A identidade da renovação não confere.', 'id_token_invalid');
      }
      // Access, refresh, expiração e escopos são trocados juntos (o refresh rotaciona).
      const next = await updateAccount(key, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        idToken: tokens.idToken ?? acc.idToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        planEnabled: hasPlanScope(tokens.scopes),
        signedOut: false,
        savedAt: nowMs,
      });
      if (!next) throw new LLMError('Conta ChatGPT não encontrada. Entre de novo.', 'reauth');
      notify();
      return next;
    } catch (err) {
      if (err instanceof SiwcError && err.code === 'refresh_invalid') {
        // Refresh não utilizável: limpa os tokens e pede novo login (o client_id salvo é reutilizado).
        await updateAccount(key, { accessToken: '', refreshToken: null, idToken: null, expiresAt: 0 });
        notify();
        throw new LLMError('A sessão do ChatGPT expirou. Entre de novo nas configurações.', 'reauth');
      }
      if (err instanceof SiwcError && (err.code === 'network' || err.code === 'server')) {
        // Falha de rede ou da infraestrutura: mantém as credenciais.
        throw new LLMError('Sem conexão com o ChatGPT para renovar a sessão. Tente de novo.', 'network');
      }
      if (err instanceof LLMError) throw err;
      throw new LLMError('Não foi possível renovar a sessão do ChatGPT. Entre de novo.', 'reauth');
    }
  })();

  refreshing.set(key, run);
  try {
    return await run;
  } finally {
    refreshing.delete(key);
  }
}

/** Token de acesso válido para o cliente de IA (renova perto da expiração; forceRefresh após 401). */
export async function getChatGPTAccessToken(opts: { forceRefresh?: boolean } = {}): Promise<string> {
  const acc = await readActiveAccount();
  if (!acc || acc.signedOut || !acc.accessToken) {
    throw new LLMError('Entre com o ChatGPT nas configurações para usar o plano.', 'reauth');
  }
  if (!opts.forceRefresh && acc.expiresAt - SIWC.refreshSkewMs > Date.now()) return acc.accessToken;
  const next = await refreshAccount(acc.key);
  return next.accessToken;
}

// ---- conta, plano e modelo -----------------------------------------------------------------------

export async function readChatGPTAccount(): Promise<ChatGPTAccountView | null> {
  return toView(await readActiveAccount());
}

/** Plano pronto para inferência: sessão + escopo concedido + elegibilidade não recusada. */
export function isPlanActive(v: ChatGPTAccountView | null): boolean {
  return !!v && v.hasSession && v.planEnabled && !v.planBlocked;
}

export async function setChatGPTModel(model: string): Promise<void> {
  const acc = await readActiveAccount();
  if (!acc) return;
  await updateAccount(acc.key, { model: model.trim() });
  notify();
}

async function listModelInfoFor(model: string): Promise<ChatGPTModel[]> {
  const provider = new OpenAIResponsesProvider(
    buildChatGPTProviderConfig(model),
    (url, init) => fetch(url, init),
    getChatGPTAccessToken,
  );
  return provider.listModelInfo();
}

/** Lista os modelos visíveis da conta. Recusa de elegibilidade desliga o plano até nova tentativa. */
export async function listChatGPTModels(): Promise<ChatGPTModel[]> {
  const acc = await readActiveAccount();
  try {
    return await listModelInfoFor(acc?.model ?? '');
  } catch (err) {
    if (err instanceof LLMError && err.code === 'plan_not_eligible') await markPlanNotEligible();
    throw err;
  }
}

/** Marca a conta como não elegível (403). O cliente de IA passa a usar a chave de API. */
export async function markPlanNotEligible(): Promise<boolean> {
  const acc = await readActiveAccount();
  if (!acc || acc.planBlocked) return false;
  await updateAccount(acc.key, { planBlocked: true });
  notify();
  return true;
}

/** Nova tentativa do plano (por exemplo, depois de assinar o Go, Plus ou Pro). */
export async function retryChatGPTPlan(): Promise<void> {
  const acc = await readActiveAccount();
  if (!acc) return;
  await updateAccount(acc.key, { planBlocked: false });
  notify();
}

// ---- saída ---------------------------------------------------------------------------------------

/**
 * Revoga o refresh token no endpoint de revogação (com retry em falha de rede/5xx) e apaga os tokens
 * locais. O registro (client_id e identidade) fica salvo para o próximo login, como o docs pede.
 * Se a revogação não for confirmada, a UI orienta a desconectar em ChatGPT > Configurações.
 */
export async function signOutChatGPT(): Promise<{ revoked: boolean }> {
  const acc = await readActiveAccount();
  if (!acc) return { revoked: false };
  let revoked = false;
  if (acc.refreshToken) {
    const spec = buildRevokeRequest({ clientId: acc.clientId, refreshToken: acc.refreshToken });
    for (let attempt = 0; attempt < 2 && !revoked; attempt++) {
      try {
        const res = await fetch(spec.url, { method: spec.method, headers: spec.headers, body: spec.body });
        if (res.ok) revoked = true;
        else if (res.status < 500) break;
      } catch {
        // rede: tenta de novo
      }
    }
  }
  await updateAccount(acc.key, {
    accessToken: '',
    refreshToken: null,
    idToken: null,
    expiresAt: 0,
    signedOut: true,
    savedAt: Date.now(),
  });
  await setActiveAccount(acc.key);
  notify();
  return { revoked };
}
