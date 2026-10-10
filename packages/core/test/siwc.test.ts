import { createHash, generateKeyPairSync, sign as nodeSign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assertLoopbackRedirect,
  base64UrlDecode,
  base64UrlEncode,
  buildAuthorizeUrl,
  buildCodeExchangeRequest,
  buildRefreshRequest,
  buildRevokeRequest,
  createPkce,
  decodeJwt,
  newHostId,
  parseCallback,
  parseTokenResponse,
  SiwcError,
  siwcErrorMessage,
  validateIdClaims,
  verifyRs256,
  type CryptoPort,
  type Jwks,
} from '../src/index';

const crypto: CryptoPort = {
  sha256: async (d) => new Uint8Array(createHash('sha256').update(d).digest()),
  randomBytes: (n) => new Uint8Array(Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256)),
};

const REDIRECT = 'http://127.0.0.1:1455/auth/callback';
const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);

function b64url(input: string | Buffer): string {
  return base64UrlEncode(new Uint8Array(Buffer.from(input)));
}

describe('base64url e PKCE', () => {
  it('round-trip de bytes', () => {
    const bytes = Uint8Array.from([0, 255, 16, 1, 2, 3, 250]);
    expect(Array.from(base64UrlDecode(base64UrlEncode(bytes)))).toEqual(Array.from(bytes));
  });

  it('vetor da RFC 7636 (apêndice B)', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    const challenge = base64UrlEncode(await crypto.sha256(new TextEncoder().encode(verifier)));
    expect(challenge).toBe(expected);
  });

  it('createPkce gera verificador de 43 caracteres e challenge S256', async () => {
    const { verifier, challenge } = await createPkce(crypto);
    expect(verifier).toHaveLength(43);
    expect(challenge).toBe(base64UrlEncode(createHash('sha256').update(verifier).digest()));
  });

  it('newHostId gera urn:uuid v4', () => {
    expect(newHostId(crypto)).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('buildAuthorizeUrl', () => {
  const base = {
    hostId: 'urn:uuid:1111',
    redirectUri: REDIRECT,
    state: 'st',
    nonce: 'no',
    codeChallenge: 'ch',
  };

  it('primeiro registro: dynamic_agent_client com agent_name_hint e sem prompt', () => {
    const url = new URL(buildAuthorizeUrl({ ...base, clientId: 'dynamic_agent_client', agentNameHint: 'Sensus' }));
    expect(url.origin + url.pathname).toBe('https://auth.openai.com/api/accounts/authorize');
    expect(url.searchParams.get('client_id')).toBe('dynamic_agent_client');
    expect(url.searchParams.get('agent_name_hint')).toBe('Sensus');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('resource')).toBe('https://api.openai.com/v1');
    expect(url.searchParams.get('ext_agent_host_id')).toBe('urn:uuid:1111');
    expect(url.searchParams.get('scope')).toBe('openid profile email offline_access resource.invoke chatgpt.tokens.use.direct');
    expect(url.searchParams.has('prompt')).toBe(false);
  });

  it('reautorização: client emitido, sem agent_name_hint; prompt=consent só sob pedido', () => {
    const url = new URL(
      buildAuthorizeUrl({ ...base, clientId: 'oaiapp_abc123', agentNameHint: 'Sensus', reconsent: true }),
    );
    expect(url.searchParams.get('client_id')).toBe('oaiapp_abc123');
    expect(url.searchParams.has('agent_name_hint')).toBe(false);
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('rejeita localhost e redirect fora de 127.0.0.1', () => {
    expect(() => assertLoopbackRedirect('http://localhost:1455/auth/callback')).toThrow(SiwcError);
    expect(() => assertLoopbackRedirect('https://127.0.0.1:1455/auth/callback')).toThrow(SiwcError);
    expect(() => assertLoopbackRedirect('http://127.0.0.1:99999/auth/callback')).toThrow(SiwcError);
    expect(assertLoopbackRedirect(REDIRECT)).toEqual({ port: 1455 });
  });
});

describe('parseCallback', () => {
  const expectReg = { redirectUri: REDIRECT, state: 'S1', clientId: 'dynamic_agent_client' };

  it('registro: devolve o client_id emitido e o código', () => {
    const r = parseCallback(`/auth/callback?code=C%2B1&state=S1&client_id=oaiapp_xyz9876`, expectReg);
    expect(r).toEqual({ code: 'C+1', issuedClientId: 'oaiapp_xyz9876' });
  });

  it('registro sem client_id emitido é erro', () => {
    expect(() => parseCallback('/auth/callback?code=c&state=S1', expectReg)).toThrow(/client_id/);
    expect(() => parseCallback('/auth/callback?code=c&state=S1&client_id=dynamic_agent_client', expectReg)).toThrow(SiwcError);
  });

  it('access_denied não troca código', () => {
    try {
      parseCallback('/auth/callback?error=access_denied&state=S1', expectReg);
      throw new Error('não lançou');
    } catch (e) {
      expect((e as SiwcError).code).toBe('access_denied');
    }
  });

  it('state diferente é rejeitado', () => {
    expect(() => parseCallback('/auth/callback?code=c&state=OUTRO&client_id=oaiapp_xyz9876', expectReg)).toThrow(
      expect.objectContaining({ message: expect.stringContaining('state') }),
    );
  });

  it('reautorização com client_id diferente é rejeitada', () => {
    const exp = { redirectUri: REDIRECT, state: 'S1', clientId: 'oaiapp_saved1' };
    expect(() => parseCallback('/auth/callback?code=c&state=S1&client_id=oaiapp_outro99', exp)).toThrow(/difere/);
    expect(parseCallback('/auth/callback?code=c&state=S1', exp).issuedClientId).toBe('oaiapp_saved1');
  });

  it('parâmetro duplicado e rota errada são rejeitados', () => {
    expect(() => parseCallback('/auth/callback?code=a&code=b&state=S1', expectReg)).toThrow(SiwcError);
    expect(() => parseCallback('/outra?code=a&state=S1&client_id=oaiapp_xyz9876', expectReg)).toThrow(SiwcError);
  });
});

describe('requisições do token endpoint', () => {
  it('troca de código: form com resource, verifier e redirect; nunca dynamic_agent_client', () => {
    const req = buildCodeExchangeRequest({ clientId: 'oaiapp_xyz9876', code: 'abc', codeVerifier: 'ver', redirectUri: REDIRECT });
    expect(req.url).toBe('https://auth.openai.com/api/accounts/oauth/token');
    const body = new URLSearchParams(req.body);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_id')).toBe('oaiapp_xyz9876');
    expect(body.get('code_verifier')).toBe('ver');
    expect(body.get('redirect_uri')).toBe(REDIRECT);
    expect(body.get('resource')).toBe('https://api.openai.com/v1');
    expect(req.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(() => buildCodeExchangeRequest({ clientId: 'dynamic_agent_client', code: 'a', codeVerifier: 'b', redirectUri: REDIRECT })).toThrow(
      SiwcError,
    );
  });

  it('refresh e revogação usam o client emitido', () => {
    const r = new URLSearchParams(buildRefreshRequest({ clientId: 'oaiapp_xyz9876', refreshToken: 'rt' }).body);
    expect(r.get('grant_type')).toBe('refresh_token');
    expect(r.get('refresh_token')).toBe('rt');
    expect(r.get('resource')).toBe('https://api.openai.com/v1');
    const v = buildRevokeRequest({ clientId: 'oaiapp_xyz9876', refreshToken: 'rt' });
    expect(v.url).toBe('https://auth.openai.com/api/accounts/oauth/revoke');
    expect(new URLSearchParams(v.body).get('token_type_hint')).toBe('refresh_token');
    expect(() => buildRefreshRequest({ clientId: 'dynamic_agent_client', refreshToken: 'rt' })).toThrow(SiwcError);
  });
});

describe('parseTokenResponse', () => {
  const ok = {
    access_token: 'AT',
    refresh_token: 'RT',
    id_token: 'a.b.c',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
  };

  it('lê escopos, expiração e refresh; expiração = agora + expires_in', () => {
    const t = parseTokenResponse(ok, { nowMs: NOW, requireIdToken: true });
    expect(t.accessToken).toBe('AT');
    expect(t.refreshToken).toBe('RT');
    expect(t.expiresAt).toBe(NOW + 3_600_000);
    expect(t.scopes).toContain('chatgpt.tokens.use.direct');
  });

  it('refresh sem scope usa os escopos anteriores; refresh rotacionado substitui', () => {
    const t = parseTokenResponse({ access_token: 'AT2', token_type: 'bearer', expires_in: '60', refresh_token: 'RT2' }, {
      nowMs: NOW,
      fallbackScopes: ['offline_access', 'chatgpt.tokens.use.direct'],
      fallbackRefreshToken: 'RT',
    });
    expect(t.scopes).toEqual(['offline_access', 'chatgpt.tokens.use.direct']);
    expect(t.refreshToken).toBe('RT2');
  });

  it('rejeita token_type não Bearer, expires_in inválido e offline_access sem refresh', () => {
    expect(() => parseTokenResponse({ ...ok, token_type: 'mac' }, { nowMs: NOW })).toThrow(SiwcError);
    expect(() => parseTokenResponse({ ...ok, expires_in: 0 }, { nowMs: NOW })).toThrow(SiwcError);
    expect(() => parseTokenResponse({ ...ok, refresh_token: undefined }, { nowMs: NOW })).toThrow(/refresh_token/);
    expect(() => parseTokenResponse({ access_token: 'x', token_type: 'Bearer', expires_in: 5 }, { nowMs: NOW })).toThrow(/escopos/);
  });
});

describe('ID token', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as { n: string; e: string };
  const jwks: Jwks = { keys: [{ kty: 'RSA', kid: 'k1', n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' }] };

  function signIdToken(claims: Record<string, unknown>, opts: { kid?: string; alg?: string; key?: typeof privateKey } = {}): string {
    const header = b64url(JSON.stringify({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'k1', typ: 'JWT' }));
    const payload = b64url(JSON.stringify(claims));
    const input = Buffer.from(`${header}.${payload}`);
    const sig = nodeSign('sha256', input, opts.key ?? privateKey);
    return `${header}.${payload}.${base64UrlEncode(new Uint8Array(sig))}`;
  }

  const good = {
    iss: 'https://auth.openai.com',
    aud: 'oaiapp_xyz9876',
    sub: 'user-123',
    email: 'pessoa@example.com',
    iat: NOW / 1000,
    exp: NOW / 1000 + 600,
    nonce: 'N1',
  };

  it('verifyRs256 aceita assinatura real e rejeita adulteração', async () => {
    const token = signIdToken(good);
    await expect(verifyRs256(decodeJwt(token), jwks, crypto)).resolves.toBeUndefined();

    const [h, , s] = token.split('.') as [string, string, string];
    const forged = b64url(JSON.stringify({ ...good, sub: 'outro' }));
    await expect(verifyRs256(decodeJwt(`${h}.${forged}.${s}`), jwks, crypto)).rejects.toMatchObject({ code: 'id_token_invalid' });
  });

  it('rejeita alg diferente de RS256 e chave de outro emissor', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    await expect(verifyRs256(decodeJwt(signIdToken(good, { alg: 'HS256' })), jwks, crypto)).rejects.toMatchObject({ code: 'id_token_invalid' });
    await expect(verifyRs256(decodeJwt(signIdToken(good, { key: other })), jwks, crypto)).rejects.toMatchObject({ code: 'id_token_invalid' });
  });

  it('validateIdClaims checa iss, aud, exp, nonce e azp', () => {
    const v = validateIdClaims(good, { clientId: 'oaiapp_xyz9876', nowMs: NOW, nonce: 'N1' });
    expect(v.sub).toBe('user-123');
    expect(v.email).toBe('pessoa@example.com');
    expect(() => validateIdClaims({ ...good, iss: 'https://evil.test' }, { clientId: 'oaiapp_xyz9876', nowMs: NOW })).toThrow(/iss/);
    expect(() => validateIdClaims(good, { clientId: 'outro_cliente', nowMs: NOW })).toThrow(/aud/);
    expect(() => validateIdClaims({ ...good, exp: NOW / 1000 - 60 }, { clientId: 'oaiapp_xyz9876', nowMs: NOW })).toThrow(/exp/);
    expect(() => validateIdClaims(good, { clientId: 'oaiapp_xyz9876', nowMs: NOW, nonce: 'OUTRO' })).toThrow(/nonce/);
    expect(() => validateIdClaims({ ...good, azp: 'x' }, { clientId: 'oaiapp_xyz9876', nowMs: NOW })).toThrow(/azp/);
  });
});

describe('mensagens de erro', () => {
  it('toda falha conhecida tem texto em pt-BR sem vazar tokens', () => {
    const codes = ['access_denied', 'state_mismatch', 'invalid_grant', 'refresh_invalid', 'scope_missing', 'network'] as const;
    for (const code of codes) {
      const msg = siwcErrorMessage(new SiwcError('segredo-interno', code));
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toContain('segredo-interno');
    }
    expect(siwcErrorMessage(new Error('x'))).toMatch(/Não foi possível/);
  });
});
