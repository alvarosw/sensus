// Sign in with ChatGPT (OpenAI, DevDay 2026): helpers puros do fluxo OAuth 2.0 + PKCE e do plano ChatGPT.
// Nada aqui faz rede nem guarda segredos: SHA-256 e bytes aleatórios chegam por CryptoPort
// (expo-crypto no app, node:crypto nos testes). Sem dependências de runtime.
// Documentação: developers.openai.com/siwc/token-sharing-open-source (sign-in, token-reference, errors-and-recovery).

export const SIWC = {
  authorizeUrl: 'https://auth.openai.com/api/accounts/authorize',
  tokenUrl: 'https://auth.openai.com/api/accounts/oauth/token',
  revokeUrl: 'https://auth.openai.com/api/accounts/oauth/revoke',
  jwksUrl: 'https://auth.openai.com/.well-known/jwks.json',
  issuer: 'https://auth.openai.com',
  /** Recurso protegido: a API pública. Vai no authorize, na troca de código e no refresh. */
  resource: 'https://api.openai.com/v1',
  scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
  /** Permissão que libera o uso do plano. Login sem ela não basta para inferência. */
  planScope: 'chatgpt.tokens.use.direct',
  /** client_id só para o primeiro registro. Nunca usar para trocar código ou renovar. */
  dynamicClientId: 'dynamic_agent_client',
  /** Porta preferida do loopback (127.0.0.1). A porta pode mudar entre logins; o redirect exato vale na troca. */
  redirectPath: '/auth/callback',
  /** Margem antes da expiração do access token para renovar (ms). */
  refreshSkewMs: 60_000,
  /** Tolerância de relógio na validação do ID token (s). */
  clockSkewSec: 5,
} as const;

export interface CryptoPort {
  sha256(data: Uint8Array): Promise<Uint8Array>;
  randomBytes(length: number): Uint8Array;
}

export type SiwcErrorCode =
  | 'access_denied'
  | 'callback_invalid'
  | 'state_mismatch'
  | 'client_id_missing'
  | 'client_id_mismatch'
  | 'redirect_invalid'
  | 'token_response'
  | 'invalid_grant'
  | 'invalid_client'
  | 'refresh_invalid'
  | 'id_token_invalid'
  | 'scope_missing'
  | 'jwks_unavailable'
  | 'network'
  | 'server';

export class SiwcError extends Error {
  readonly code: SiwcErrorCode;
  readonly status: number | undefined;

  constructor(message: string, code: SiwcErrorCode, status?: number) {
    super(message);
    this.name = 'SiwcError';
    this.code = code;
    this.status = status;
  }
}

// ---- bytes, base64url, UTF-8 ----------------------------------------------------------------

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function base64UrlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64URL[(n >> 18) & 63];
    out += B64URL[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64URL[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64URL[n & 63];
  }
  return out;
}

export function base64UrlDecode(input: string): Uint8Array {
  const clean = input.replace(/=+$/, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = B64URL.indexOf(ch);
    if (v < 0) throw new SiwcError('Base64url inválido.', 'id_token_invalid');
    buffer = ((buffer << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

export function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// ---- PKCE, state, nonce, host ---------------------------------------------------------------

/** Valor aleatório em base64url (32 bytes -> 43 caracteres). Serve de state, nonce e verificador. */
export function randomToken(crypto: CryptoPort, bytes = 32): string {
  return base64UrlEncode(crypto.randomBytes(bytes));
}

export interface PkcePair {
  verifier: string;
  /** SHA-256 do verificador, em base64url (code_challenge_method=S256). */
  challenge: string;
}

export async function createPkce(crypto: CryptoPort): Promise<PkcePair> {
  const verifier = randomToken(crypto, 32);
  const challenge = base64UrlEncode(await crypto.sha256(utf8Encode(verifier)));
  return { verifier, challenge };
}

/** Identificador estável do host (uma vez por instalação): urn:uuid v4 (aceito pelo ext_agent_host_id). */
export function newHostId(crypto: CryptoPort): string {
  const b = crypto.randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---- form encoding -------------------------------------------------------------------------

function formEncode(fields: Record<string, string | undefined>): string {
  return Object.entries(fields)
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

const FORM_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'application/json',
} as const;

export interface HttpRequestSpec {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}

// ---- authorize -----------------------------------------------------------------------------

/** O redirect tem de ser HTTP em 127.0.0.1 (não 'localhost'), com a rota de callback. */
export function assertLoopbackRedirect(redirectUri: string): { port: number } {
  const m = /^http:\/\/127\.0\.0\.1:(\d{1,5})(\/auth\/callback)$/.exec(redirectUri);
  const port = m ? Number(m[1]) : NaN;
  if (!m || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SiwcError(`redirect_uri inválido (use http://127.0.0.1:<porta>${SIWC.redirectPath}).`, 'redirect_invalid');
  }
  return { port };
}

export function loopbackRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}${SIWC.redirectPath}`;
}

export interface AuthorizeParams {
  /** dynamic_agent_client no primeiro registro; o client_id emitido nos demais logins. */
  clientId: string;
  hostId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  /** Só no primeiro registro (o docs pede omitir na reautorização). Ignorado para outros client_ids. */
  agentNameHint?: string;
  loginHint?: string;
  idTokenHint?: string;
  /** Pedido explícito do usuário para liberar o plano: prompt=consent. Não usar em logins comuns. */
  reconsent?: boolean;
}

export function buildAuthorizeUrl(p: AuthorizeParams): string {
  assertLoopbackRedirect(p.redirectUri);
  const query = formEncode({
    client_id: p.clientId,
    response_type: 'code',
    redirect_uri: p.redirectUri,
    scope: SIWC.scope,
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.codeChallenge,
    code_challenge_method: 'S256',
    resource: SIWC.resource,
    ext_agent_host_id: p.hostId,
    agent_name_hint: p.clientId === SIWC.dynamicClientId ? p.agentNameHint : undefined,
    login_hint: p.loginHint,
    id_token_hint: p.idTokenHint,
    prompt: p.reconsent ? 'consent' : undefined,
  });
  return `${SIWC.authorizeUrl}?${query}`;
}

// ---- callback ------------------------------------------------------------------------------

export interface CallbackExpectation {
  redirectUri: string;
  state: string;
  /** client_id usado no authorize (dynamic_agent_client no registro; o emitido depois). */
  clientId: string;
}

export interface CallbackResult {
  code: string;
  /** client_id emitido. No registro é obrigatório e deve ser salvo; na reautorização deve coincidir. */
  issuedClientId: string;
}

function parseQuery(url: string): { path: string; params: Map<string, string> } {
  const q = url.indexOf('?');
  const path = q === -1 ? url : url.slice(0, q);
  const params = new Map<string, string>();
  const raw = q === -1 ? '' : url.slice(q + 1).split('#')[0]!;
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decodeURIComponent((eq === -1 ? pair : pair.slice(0, eq)).replace(/\+/g, ' '));
    const value = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
    if (params.has(key)) throw new SiwcError(`Parâmetro duplicado no callback: ${key}.`, 'callback_invalid');
    params.set(key, value);
  }
  return { path, params };
}

const CLIENT_ID_RE = /^[A-Za-z0-9_.-]{8,128}$/;

/** Valida o callback do loopback: rota, error=access_denied, state e client_id emitido. */
export function parseCallback(callbackUrl: string, expect: CallbackExpectation): CallbackResult {
  assertLoopbackRedirect(expect.redirectUri);
  const { path, params } = parseQuery(callbackUrl);
  if (path !== SIWC.redirectPath) throw new SiwcError('Callback em rota inesperada.', 'callback_invalid');

  const error = params.get('error');
  if (error === 'access_denied') throw new SiwcError('Acesso negado no ChatGPT.', 'access_denied');
  if (error) throw new SiwcError(`O ChatGPT devolveu erro: ${error}.`, 'callback_invalid');

  if (params.get('state') !== expect.state) throw new SiwcError('O callback não corresponde a este login (state).', 'state_mismatch');

  const code = params.get('code');
  if (!code) throw new SiwcError('Callback sem código de autorização.', 'callback_invalid');

  const sent = params.get('client_id');
  const registering = expect.clientId === SIWC.dynamicClientId;
  if (registering) {
    if (!sent || sent === SIWC.dynamicClientId || !CLIENT_ID_RE.test(sent)) {
      throw new SiwcError('O registro não devolveu o client_id emitido.', 'client_id_missing');
    }
    return { code, issuedClientId: sent };
  }
  if (sent && sent !== expect.clientId) {
    throw new SiwcError('O client_id do callback difere do salvo para esta conta.', 'client_id_mismatch');
  }
  return { code, issuedClientId: expect.clientId };
}

// ---- token endpoint requests ----------------------------------------------------------------

export function buildCodeExchangeRequest(p: {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): HttpRequestSpec {
  if (p.clientId === SIWC.dynamicClientId) {
    throw new SiwcError('Nunca trocar código com dynamic_agent_client: use o client_id emitido.', 'invalid_client');
  }
  assertLoopbackRedirect(p.redirectUri);
  return {
    url: SIWC.tokenUrl,
    method: 'POST',
    headers: { ...FORM_HEADERS },
    body: formEncode({
      grant_type: 'authorization_code',
      client_id: p.clientId,
      code: p.code,
      code_verifier: p.codeVerifier,
      redirect_uri: p.redirectUri,
      resource: SIWC.resource,
    }),
  };
}

/** Refresh: o refresh_token é rotacionado; guarde access, refresh, expiração e escopos juntos. */
export function buildRefreshRequest(p: { clientId: string; refreshToken: string }): HttpRequestSpec {
  if (p.clientId === SIWC.dynamicClientId) {
    throw new SiwcError('Nunca renovar com dynamic_agent_client: use o client_id emitido.', 'invalid_client');
  }
  return {
    url: SIWC.tokenUrl,
    method: 'POST',
    headers: { ...FORM_HEADERS },
    body: formEncode({
      grant_type: 'refresh_token',
      client_id: p.clientId,
      refresh_token: p.refreshToken,
      resource: SIWC.resource,
    }),
  };
}

/** Revogação no endpoint da OpenID configuration, com o client_id emitido. */
export function buildRevokeRequest(p: { clientId: string; refreshToken: string }): HttpRequestSpec {
  return {
    url: SIWC.revokeUrl,
    method: 'POST',
    headers: { ...FORM_HEADERS },
    body: formEncode({
      token: p.refreshToken,
      token_type_hint: 'refresh_token',
      client_id: p.clientId,
    }),
  };
}

// ---- token response -----------------------------------------------------------------------

export interface TokenSet {
  accessToken: string;
  /** Presente quando offline_access foi concedido. Rotaciona a cada refresh. */
  refreshToken: string | null;
  idToken: string | null;
  /** Epoch em ms em que o access token expira (now + expires_in). */
  expiresAt: number;
  scopes: string[];
}

export function parseScopes(scope: string | null | undefined): string[] {
  return (scope ?? '').split(/\s+/).filter(Boolean);
}

export function hasPlanScope(scopes: readonly string[]): boolean {
  return scopes.includes(SIWC.planScope);
}

export function parseTokenResponse(
  json: unknown,
  opts: { nowMs: number; fallbackScopes?: readonly string[]; fallbackRefreshToken?: string | null; requireIdToken?: boolean },
): TokenSet {
  if (!json || typeof json !== 'object') throw new SiwcError('Resposta do token não é um objeto JSON.', 'token_response');
  const r = json as Record<string, unknown>;

  const accessToken = r.access_token;
  if (typeof accessToken !== 'string' || !accessToken) throw new SiwcError('Resposta sem access_token.', 'token_response');
  const tokenType = typeof r.token_type === 'string' ? r.token_type.toLowerCase() : '';
  if (tokenType !== 'bearer') throw new SiwcError('token_type diferente de Bearer.', 'token_response');

  const expiresIn = typeof r.expires_in === 'string' ? Number(r.expires_in) : r.expires_in;
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new SiwcError('expires_in inválido.', 'token_response');
  }

  let scopes: string[];
  if (typeof r.scope === 'string') scopes = parseScopes(r.scope);
  else if (opts.fallbackScopes) scopes = [...opts.fallbackScopes];
  else throw new SiwcError('Resposta sem a lista de escopos concedidos.', 'token_response');

  const refresh = typeof r.refresh_token === 'string' && r.refresh_token ? r.refresh_token : (opts.fallbackRefreshToken ?? null);
  if (scopes.includes('offline_access') && !refresh) {
    throw new SiwcError('offline_access concedido, mas sem refresh_token.', 'token_response');
  }

  const idToken = typeof r.id_token === 'string' && r.id_token ? r.id_token : null;
  if (opts.requireIdToken && !idToken) throw new SiwcError('Resposta sem id_token.', 'token_response');

  return {
    accessToken,
    refreshToken: refresh,
    idToken,
    expiresAt: opts.nowMs + expiresIn * 1000,
    scopes,
  };
}

// ---- JWT, ID token, RS256 -----------------------------------------------------------------

export interface DecodedJwt {
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
  signingInput: Uint8Array;
  signature: Uint8Array;
}

export function decodeJwt(token: string): DecodedJwt {
  const parts = token.split('.');
  if (parts.length !== 3) throw new SiwcError('ID token malformado.', 'id_token_invalid');
  const [h, p, s] = parts as [string, string, string];
  try {
    return {
      header: JSON.parse(utf8Decode(base64UrlDecode(h))) as Record<string, unknown>,
      claims: JSON.parse(utf8Decode(base64UrlDecode(p))) as Record<string, unknown>,
      signingInput: utf8Encode(`${h}.${p}`),
      signature: base64UrlDecode(s),
    };
  } catch (err) {
    if (err instanceof SiwcError) throw err;
    throw new SiwcError('ID token malformado.', 'id_token_invalid');
  }
}

export interface Jwk {
  kty: string;
  kid?: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
}

export interface Jwks {
  keys: Jwk[];
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  return x;
}

function bigIntToBytes(x: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let v = x;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

/** Prefixo DigestInfo do SHA-256 (RFC 8017, EMSA-PKCS1-v1_5). */
const SHA256_DIGEST_INFO = Uint8Array.from([
  0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20,
]);

/**
 * Verifica a assinatura RS256 do ID token contra o JWKS da OpenAI (RSASSA-PKCS1-v1_5 com SHA-256).
 * Implementação própria com BigInt: sem dependências. Lança id_token_invalid se não bater.
 */
export async function verifyRs256(decoded: DecodedJwt, jwks: Jwks, crypto: CryptoPort): Promise<void> {
  if (decoded.header.alg !== 'RS256') throw new SiwcError('ID token não assinado com RS256.', 'id_token_invalid');
  const kid = typeof decoded.header.kid === 'string' ? decoded.header.kid : undefined;
  const jwk = jwks.keys.find((k) => k.kty === 'RSA' && (kid === undefined || k.kid === kid));
  if (!jwk?.n || !jwk.e) throw new SiwcError('Chave de assinatura não encontrada no JWKS.', 'id_token_invalid');

  const n = bytesToBigInt(base64UrlDecode(jwk.n));
  const e = bytesToBigInt(base64UrlDecode(jwk.e));
  const k = base64UrlDecode(jwk.n).length;
  const sig = decoded.signature;
  if (sig.length !== k) throw new SiwcError('Assinatura do ID token com tamanho inválido.', 'id_token_invalid');
  const s = bytesToBigInt(sig);
  if (s >= n) throw new SiwcError('Assinatura do ID token inválida.', 'id_token_invalid');

  const em = bigIntToBytes(modPow(s, e, n), k);
  const digest = await crypto.sha256(decoded.signingInput);
  const t = new Uint8Array(SHA256_DIGEST_INFO.length + digest.length);
  t.set(SHA256_DIGEST_INFO, 0);
  t.set(digest, SHA256_DIGEST_INFO.length);
  const ps = k - t.length - 3;
  if (ps < 8) throw new SiwcError('Chave de assinatura pequena demais.', 'id_token_invalid');
  const expected = new Uint8Array(k);
  expected[1] = 0x01;
  expected.fill(0xff, 2, 2 + ps);
  expected.set(t, 3 + ps);

  let diff = 0;
  for (let i = 0; i < k; i++) diff |= em[i]! ^ expected[i]!;
  if (diff !== 0) throw new SiwcError('Assinatura do ID token inválida.', 'id_token_invalid');
}

export interface IdentityClaims {
  /** Identidade da conta (sub). Chave de armazenamento junto com o client_id. */
  sub: string;
  email: string | null;
  iss: string;
  aud: string[];
  exp: number;
  iat: number;
}

/** Checa iss, aud (= client_id), exp, iat, sub, nonce (no login) e azp. */
export function validateIdClaims(
  claims: Record<string, unknown>,
  opts: { clientId: string; nowMs: number; nonce?: string; skewSec?: number },
): IdentityClaims {
  const skew = opts.skewSec ?? SIWC.clockSkewSec;
  const nowS = opts.nowMs / 1000;
  const fail = (m: string) => new SiwcError(`ID token inválido: ${m}.`, 'id_token_invalid');

  if (claims.iss !== SIWC.issuer) throw fail('iss');
  const aud = typeof claims.aud === 'string' ? [claims.aud] : Array.isArray(claims.aud) ? claims.aud.filter((x): x is string => typeof x === 'string') : [];
  if (!aud.includes(opts.clientId)) throw fail('aud');
  if (claims.azp !== undefined && claims.azp !== opts.clientId) throw fail('azp');
  if (typeof claims.exp !== 'number' || nowS - skew >= claims.exp) throw fail('exp');
  if (typeof claims.iat !== 'number' || claims.iat > nowS + skew) throw fail('iat');
  if (typeof claims.sub !== 'string' || !claims.sub) throw fail('sub');
  if (opts.nonce !== undefined && claims.nonce !== opts.nonce) throw fail('nonce');

  return {
    sub: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    iss: claims.iss,
    aud,
    exp: claims.exp,
    iat: claims.iat,
  };
}

/**
 * Decodifica e valida o ID token. Com `jwks`, verifica a assinatura RS256 (recomendado).
 * Sem `jwks`, só checa as claims: use apenas para tokens recebidos direto do endpoint por TLS
 * (OIDC Core 3.1.3.7 permite isso) ou em testes.
 */
export async function verifyIdToken(
  idToken: string,
  opts: { clientId: string; nowMs: number; nonce?: string; jwks?: Jwks; crypto: CryptoPort },
): Promise<IdentityClaims> {
  const decoded = decodeJwt(idToken);
  if (opts.jwks) await verifyRs256(decoded, opts.jwks, opts.crypto);
  return validateIdClaims(decoded.claims, { clientId: opts.clientId, nowMs: opts.nowMs, nonce: opts.nonce });
}

// ---- mensagens (pt-BR) --------------------------------------------------------------------

/** Mensagem amigável para falhas do login/renovação. Não inclui tokens. */
export function siwcErrorMessage(err: unknown): string {
  if (!(err instanceof SiwcError)) return 'Não foi possível entrar com o ChatGPT. Tente de novo.';
  switch (err.code) {
    case 'access_denied':
      return 'Você recusou o acesso no ChatGPT. Para usar o plano, tente de novo e aceite a permissão.';
    case 'state_mismatch':
    case 'callback_invalid':
      return 'O retorno do ChatGPT não pôde ser validado. Tente entrar de novo.';
    case 'client_id_missing':
    case 'client_id_mismatch':
      return 'O ChatGPT devolveu uma conta diferente da esperada. Entre de novo na conta correta.';
    case 'invalid_grant':
      return 'O código do login expirou ou já foi usado. Tente entrar de novo.';
    case 'invalid_client':
      return 'Configuração do cliente ChatGPT inválida. Avise o desenvolvedor do Sensus.';
    case 'refresh_invalid':
      return 'A sessão do ChatGPT expirou. Entre de novo.';
    case 'scope_missing':
      return 'O ChatGPT não concedeu a permissão do plano. Você pode tentar de novo ou usar uma chave de API.';
    case 'id_token_invalid':
      return 'A identidade do ChatGPT não pôde ser verificada. Tente entrar de novo.';
    case 'jwks_unavailable':
    case 'network':
      return 'Sem conexão com o ChatGPT. Verifique a internet e tente de novo.';
    case 'server':
      return 'O ChatGPT está indisponível no momento. Tente de novo em instantes.';
    default:
      return 'Não foi possível concluir o login com o ChatGPT. Tente de novo.';
  }
}
