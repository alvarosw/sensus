// Persistência das contas ChatGPT: um registro por (client_id emitido, sub). Tudo no expo-secure-store
// (Keychain / Keystore); nada vai para arquivos, logs ou o banco de dados do app.
import * as SecureStore from 'expo-secure-store';
import { readSecret, writeSecret } from './secure';

export interface StoredAccount {
  /** Chave de armazenamento: derivada de client_id + sub. */
  key: string;
  /** client_id emitido no registro (oaiapp_...). Nunca dynamic_agent_client. */
  clientId: string;
  /** Identidade (sub do ID token). */
  sub: string;
  email: string | null;
  /** ext_agent_host_id usado no registro: estável por instalação. */
  hostId: string;
  /** Escopos concedidos na última troca/renovação. */
  scopes: string[];
  /** Concedido: o escopo chatgpt.tokens.use.direct está nos escopos. */
  planEnabled: boolean;
  /** Último 403 de elegibilidade: o plano não está disponível para esta conta. */
  planBlocked: boolean;
  /** Sessão recusada depois da renovação (refresh inutilizável ou 401 persistente): precisa de novo login. Opcional: registros antigos não têm. */
  needsReauth?: boolean;
  /** Modelo escolhido (id da lista da conta). Vazio até listar. */
  model: string;
  /** Vazios quando a sessão foi encerrada (o registro e o client_id ficam, como o docs pede). */
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  expiresAt: number;
  signedOut: boolean;
  savedAt: number;
}

/** Visão para a UI: sem tokens. */
export interface ChatGPTAccountView {
  key: string;
  email: string | null;
  planEnabled: boolean;
  planBlocked: boolean;
  needsReauth: boolean;
  /** Conta salva e não encerrada pelo usuário (mesmo que a sessão precise de novo login). */
  connected: boolean;
  model: string;
  hasSession: boolean;
  savedAt: number;
}

interface Index {
  keys: string[];
  activeKey: string | null;
}

const INDEX_KEY = 'sensus.chatgpt.index';
const HOST_KEY = 'sensus.chatgpt.hostid';
const ACCOUNT_PREFIX = 'sensus.chatgpt.acc.';

function fnv1a(input: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Chave estável e segura para o SecureStore (só [A-Za-z0-9._-]). */
export function accountKey(clientId: string, sub: string): string {
  return `${ACCOUNT_PREFIX}${fnv1a(`${clientId}\n${sub}`, 0x811c9dc5)}${fnv1a(`${sub}|${clientId}`, 0x9e3779b9)}`;
}

// Escritas em sequência: evita que duas renovações gravem contas ou índices pela metade.
let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

/** Leitura tolerante: na web (sem SecureStore) ou sem permissão, devolve null em vez de quebrar a tela. */
async function safeGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function readIndex(): Promise<Index> {
  const raw = await safeGet(INDEX_KEY);
  if (!raw) return { keys: [], activeKey: null };
  try {
    const parsed = JSON.parse(raw) as Partial<Index>;
    return {
      keys: Array.isArray(parsed.keys) ? parsed.keys.filter((k): k is string => typeof k === 'string') : [],
      activeKey: typeof parsed.activeKey === 'string' ? parsed.activeKey : null,
    };
  } catch {
    return { keys: [], activeKey: null };
  }
}

async function writeIndex(index: Index): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(index));
}

function isAccount(v: unknown): v is StoredAccount {
  const a = v as Partial<StoredAccount> | null;
  return !!a && typeof a.key === 'string' && typeof a.clientId === 'string' && typeof a.sub === 'string';
}

export async function readAccount(key: string): Promise<StoredAccount | null> {
  try {
    const raw = await readSecret(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAccount(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Conta ativa (com ou sem sessão). */
export async function readActiveAccount(): Promise<StoredAccount | null> {
  const index = await readIndex();
  return index.activeKey ? readAccount(index.activeKey) : null;
}

export async function saveAccount(account: StoredAccount, makeActive: boolean): Promise<void> {
  await exclusive(async () => {
    await writeSecret(account.key, JSON.stringify(account));
    const index = await readIndex();
    const keys = index.keys.includes(account.key) ? index.keys : [...index.keys, account.key];
    const activeKey = makeActive ? account.key : index.activeKey;
    await writeIndex({ keys, activeKey });
  });
}

/** Atualização parcial (renovação, marca de plano, modelo) sob a mesma fila de escrita. */
export async function updateAccount(key: string, patch: Partial<StoredAccount>): Promise<StoredAccount | null> {
  return exclusive(async () => {
    const current = await readAccount(key);
    if (!current) return null;
    const next = { ...current, ...patch };
    await writeSecret(key, JSON.stringify(next));
    return next;
  });
}

export async function setActiveAccount(key: string | null): Promise<void> {
  await exclusive(async () => {
    const index = await readIndex();
    await writeIndex({ ...index, activeKey: key });
  });
}

/** Host estável por instalação, criado na primeira vez e reutilizado em todo login. */
export async function getOrCreateHostId(create: () => string): Promise<string> {
  const existing = await safeGet(HOST_KEY);
  if (existing) return existing;
  const hostId = create();
  await SecureStore.setItemAsync(HOST_KEY, hostId);
  return hostId;
}

export function toView(a: StoredAccount | null): ChatGPTAccountView | null {
  if (!a) return null;
  return {
    key: a.key,
    email: a.email,
    planEnabled: a.planEnabled,
    planBlocked: a.planBlocked,
    needsReauth: a.needsReauth === true,
    connected: !a.signedOut,
    model: a.model,
    hasSession: !a.signedOut && !!a.accessToken && !!a.refreshToken,
    savedAt: a.savedAt,
  };
}
