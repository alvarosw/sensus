// Servidor de retorno do OAuth em 127.0.0.1 (loopback), com TCP nativo (react-native-tcp-socket).
// Exige build de desenvolvimento: no Expo Go o módulo não existe e isChatGPTNativeAvailable() dá false.
// Só aceita GET em /auth/callback; responde uma página HTML curta e encerra.
import { NativeModules, Platform } from 'react-native';
import { SIWC, loopbackRedirectUri } from '@sensus/core';

/** Portas tentadas em ordem. O redirect exato (com a porta escolhida) vai no authorize e na troca. */
const PORTS = [1455, 1456, 1457, 1458, 1459] as const;
const MAX_REQUEST_BYTES = 16 * 1024;

export class ChatGPTNativeUnavailableError extends Error {
  constructor() {
    super('Disponível no app instalado (build de desenvolvimento).');
    this.name = 'ChatGPTNativeUnavailableError';
  }
}

interface TcpSocketLike {
  on(event: 'data', cb: (data: unknown) => void): unknown;
  on(event: 'error' | 'close', cb: () => void): unknown;
  write(data: string): unknown;
  end(): unknown;
}

interface TcpServerLike {
  on(event: 'error', cb: (err: unknown) => void): unknown;
  listen(options: { port: number; host: string }, cb?: () => void): unknown;
  close(cb?: () => void): unknown;
}

interface TcpModuleLike {
  createServer(listener: (socket: TcpSocketLike) => void): TcpServerLike;
}

/** Carrega o módulo nativo sob demanda: no Expo Go ou na web retorna null em vez de quebrar o app. */
function loadTcpModule(): TcpModuleLike | null {
  if (Platform.OS === 'web') return null;
  // Sem o módulo nativo (Expo Go), a biblioteca carrega mas não tem como escutar: tratar como indisponível.
  if (!(NativeModules as Record<string, unknown>).TcpSockets) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-tcp-socket') as { default?: TcpModuleLike } & Partial<TcpModuleLike>;
    const m = (mod.default ?? mod) as Partial<TcpModuleLike>;
    return typeof m.createServer === 'function' ? (m as TcpModuleLike) : null;
  } catch {
    return null;
  }
}

export function isChatGPTNativeAvailable(): boolean {
  return loadTcpModule() !== null;
}

/** HTML ASCII (entidades nomeadas) para que Content-Length seja o tamanho em bytes. */
const CALLBACK_PAGE = [
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>Sensus</title>',
  '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;',
  'background:#F4F1EA;color:#2B2A26;font-family:system-ui,sans-serif}',
  'main{text-align:center;padding:24px}a{color:#6B4F2A;font-weight:600}</style></head>',
  '<body><main><h1>Pronto! Volte ao Sensus</h1>',
  '<p>Voc&ecirc; j&aacute; pode fechar esta p&aacute;gina.</p>',
  '<p><a href="sensus://settings">Abrir o Sensus</a></p></main>',
  '<script>setTimeout(function(){location.href="sensus://settings";},400);</script>',
  '</body></html>',
].join('');

function httpResponse(status: string, contentType: string, body: string): string {
  return [
    `HTTP/1.1 ${status}`,
    `Content-Type: ${contentType}`,
    `Content-Length: ${body.length}`,
    'Cache-Control: no-store',
    "Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
    'Connection: close',
    '',
    body,
  ].join('\r\n');
}

export interface LoopbackCallback {
  redirectUri: string;
  /** Alvo da requisição recebida (ex.: "/auth/callback?code=...&state=..."). */
  target: Promise<string>;
  close(): void;
}

function listenOn(
  tcp: TcpModuleLike,
  port: number,
  onRequest: (target: string | null, respond: (raw: string) => void, fail: () => void) => void,
): Promise<TcpServerLike> {
  return new Promise((resolve, reject) => {
    const server = tcp.createServer((socket) => {
      let buffer = '';
      let handled = false;
      socket.on('data', (data) => {
        if (handled) return;
        buffer += String(data);
        if (buffer.length > MAX_REQUEST_BYTES) {
          handled = true;
          socket.write(httpResponse('431 Request Header Fields Too Large', 'text/plain; charset=utf-8', 'Requisição grande demais.'));
          socket.end();
          return;
        }
        const end = buffer.indexOf('\r\n\r\n');
        if (end === -1) return;
        handled = true;
        const firstLine = buffer.slice(0, buffer.indexOf('\r\n'));
        const m = /^GET (\S+) HTTP\/1\.[01]$/.exec(firstLine);
        const target = m ? m[1]! : null;
        const respond = (raw: string) => {
          socket.write(raw);
          socket.end();
        };
        onRequest(target, respond, () => {
          respond(httpResponse('404 Not Found', 'text/plain; charset=utf-8', 'Nao encontrado.'));
        });
      });
      socket.on('error', () => undefined);
      socket.on('close', () => undefined);
    });
    server.on('error', (err) => reject(err));
    server.listen({ port, host: '127.0.0.1' }, () => resolve(server));
  });
}

/**
 * Sobe o listener antes de abrir o navegador. `target` resolve com o primeiro GET em /auth/callback
 * (a página de confirmação já foi enviada) ou rejeita após `timeoutMs`.
 */
export async function startLoopbackCallback(timeoutMs = 5 * 60_000): Promise<LoopbackCallback> {
  const tcp = loadTcpModule();
  if (!tcp) throw new ChatGPTNativeUnavailableError();

  let resolveTarget: (target: string) => void = () => undefined;
  let rejectTarget: (err: Error) => void = () => undefined;
  const target = new Promise<string>((res, rej) => {
    resolveTarget = res;
    rejectTarget = rej;
  });
  target.catch(() => undefined);

  const onRequest = (raw: string | null, respond: (raw: string) => void, fail: () => void) => {
    if (raw === null || !raw.startsWith(SIWC.redirectPath)) {
      fail();
      return;
    }
    respond(httpResponse('200 OK', 'text/html; charset=utf-8', CALLBACK_PAGE));
    resolveTarget(raw);
  };

  let server: TcpServerLike | null = null;
  let port = 0;
  for (const candidate of PORTS) {
    try {
      server = await listenOn(tcp, candidate, onRequest);
      port = candidate;
      break;
    } catch {
      // porta ocupada: tenta a próxima
    }
  }
  if (!server) {
    throw new Error('Não foi possível abrir a porta de retorno (1455-1459). Feche outros apps que a usem e tente de novo.');
  }

  const srv = server;
  const timer = setTimeout(() => rejectTarget(new Error('O login com o ChatGPT demorou demais. Tente de novo.')), timeoutMs);
  return {
    redirectUri: loopbackRedirectUri(port),
    target: target.finally(() => clearTimeout(timer)),
    close: () => {
      clearTimeout(timer);
      srv.close();
    },
  };
}
