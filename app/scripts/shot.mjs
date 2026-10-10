#!/usr/bin/env node
// Captura de tela do app na web (Playwright + Chromium), sem celular.
//
//   node scripts/shot.mjs --port 8091 --route "/" --out /tmp/home.png
//   node scripts/shot.mjs --port 8091 --route "/" --scheme dark \
//        --steps '[{"tap":"verse-50002005"},{"wait":800}]' --out /tmp/x.png
//   node scripts/shot.mjs --port 8091 --route "/study?start=50002005&end=50002008" \
//        --wait-text "Perguntas" --timeout 90000 --out /tmp/study.png
//
// Imprime no stdout SOMENTE os caminhos dos PNGs gerados (um por linha; o último é a captura
// final). Logs e avisos vão para o stderr. Código de saída: 0 ok; 1 falha (passo, timeout, erro de
// navegação, bundle quebrado ou tela de erro); 2 uso incorreto.
//
// Servidor: se não houver nada escutando em --port, inicia `npx expo start --web --port <p>` e o
// encerra ao terminar (use --keep-server para deixá-lo rodando e reaproveitar nas próximas capturas).
// Se já houver um servidor, ele é reaproveitado e nunca é encerrado.
//
// Passos (--steps JSON, array; ou flags repetíveis, executadas na ordem em que aparecem):
//   {"tap":"<testID>"}                      --tap <testID>             toca pelo testID (data-testid)
//   {"tapText":"<texto>","exact":true}      --tap-text <texto>         toca pelo texto visível
//   {"type":"<testID>","text":"..."}        --type <testID>=<texto>    digita num campo (substitui o conteúdo)
//   {"press":"Enter"}                       --press <tecla>            tecla de teclado
//   {"scroll":"<testID>|page","by":400}     --scroll <testID|page>=<px>  rola (px; negativo = para cima)
//   {"scroll":"<testID>|page","to":"bottom"|"top"}
//   {"waitText":"<texto>"}                  --wait-text <texto>        espera o texto aparecer
//   {"waitId":"<testID>"}                   --wait-id <testID>         espera o testID aparecer
//   {"waitGoneText":"<texto>"} / {"waitGoneId":"<testID>"}   --wait-gone-text / --wait-gone-id
//   {"wait":800}                            --wait <ms>
//   {"waitStable":1500}                     --wait-stable <ms>         espera o texto da página ficar parado N ms
//                                            (fim de um stream da IA); use "timeout" alto
//   {"shot":"/tmp/y.png","element":"<testID>"}  --shot <arquivo>      captura intermediária
//   {"goto":"/rota"}                        --goto <rota>
// Qualquer passo aceita "timeout" (ms) e, nos de texto, "nth" (0-based) para escolher a ocorrência.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Uso: node scripts/shot.mjs --port <p> --out <arquivo.png> [opções]

  --port <p>            porta do servidor web do Expo (obrigatória)
  --route <rota>        rota a abrir (padrão "/"), ex.: "/study?start=50002005&end=50002008"
  --out <arquivo.png>   captura final (padrão /tmp/sensus-shot.png)
  --scheme light|dark   esquema de cores (padrão light)
  --steps '<json>'      passos (array JSON)       --steps-file <arquivo.json>
  --tap/--tap-text/--type/--press/--scroll/--wait/--wait-text/--wait-id/--shot/--goto  (passos em flags)
  --ready-text <texto>  espera este texto antes dos passos (além do banco pronto)
  --element <testID>    a captura final é só deste elemento
  --full-page           captura a página inteira
  --width/--height/--dpr   viewport (padrão 390x844 @2x)
  --timeout <ms>        limite por passo (padrão 15000)
  --nav-timeout <ms>    limite da abertura da página/banco (padrão 120000)
  --settle <ms>         pausa antes da captura final (padrão 400)
  --profile <dir>       perfil persistente do Chromium (mantém OPFS/localStorage entre execuções)
  --demo 0|1            EXPO_PUBLIC_SENSUS_DEMO ao iniciar o servidor
  --keep-server         não encerra o servidor iniciado por este comando
  --stop                encerra o servidor iniciado por este comando em --port e sai
  --allow-errors        não falha por tela de erro/erros de página
  --verbose             mostra avisos e erros do console do navegador
`;

function log(...a) {
  console.error('[shot]', ...a);
}

function die(message, code = 1) {
  console.error(`[shot] ERRO: ${message}`);
  process.exit(code);
}

// ---------------------------------------------------------------------------------------------
// argumentos
// ---------------------------------------------------------------------------------------------

const VALUE_FLAGS = new Set([
  'port', 'route', 'out', 'scheme', 'steps', 'steps-file', 'ready-text', 'element', 'width', 'height',
  'dpr', 'timeout', 'nav-timeout', 'settle', 'profile', 'demo',
  'tap', 'tap-text', 'type', 'press', 'scroll', 'wait', 'wait-text', 'wait-id', 'wait-gone-text',
  'wait-gone-id', 'wait-stable', 'shot', 'goto',
]);
const BOOL_FLAGS = new Set(['full-page', 'keep-server', 'stop', 'allow-errors', 'verbose', 'help']);

function splitOnce(value, flag) {
  const i = value.indexOf('=');
  if (i <= 0) die(`--${flag} espera "<alvo>=<valor>", recebeu "${value}"`, 2);
  return [value.slice(0, i), value.slice(i + 1)];
}

function parseArgv(argv) {
  const opts = {};
  const steps = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) die(`argumento inesperado: ${arg}\n${USAGE}`, 2);
    const eq = arg.indexOf('=');
    const name = arg.slice(2, eq > 0 && VALUE_FLAGS.has(arg.slice(2, eq)) ? eq : undefined);
    let value;
    if (BOOL_FLAGS.has(name)) {
      opts[name] = true;
      continue;
    }
    if (!VALUE_FLAGS.has(name)) die(`opção desconhecida: --${name}\n${USAGE}`, 2);
    if (eq > 0 && arg.slice(2, eq) === name) value = arg.slice(eq + 1);
    else {
      value = argv[++i];
      if (value === undefined) die(`--${name} exige um valor`, 2);
    }
    switch (name) {
      case 'steps': {
        let parsed;
        try {
          parsed = JSON.parse(value);
        } catch (e) {
          die(`--steps não é JSON válido: ${e.message}`, 2);
        }
        steps.push(...(Array.isArray(parsed) ? parsed : [parsed]));
        break;
      }
      case 'steps-file': {
        let parsed;
        try {
          parsed = JSON.parse(readFileSync(resolve(value), 'utf8'));
        } catch (e) {
          die(`--steps-file ilegível: ${e.message}`, 2);
        }
        steps.push(...(Array.isArray(parsed) ? parsed : [parsed]));
        break;
      }
      case 'tap': steps.push({ tap: value }); break;
      case 'tap-text': steps.push({ tapText: value }); break;
      case 'type': { const [id, text] = splitOnce(value, 'type'); steps.push({ type: id, text }); break; }
      case 'press': steps.push({ press: value }); break;
      case 'scroll': {
        const [target, by] = splitOnce(value, 'scroll');
        steps.push(by === 'top' || by === 'bottom' ? { scroll: target, to: by } : { scroll: target, by: Number(by) });
        break;
      }
      case 'wait': steps.push({ wait: Number(value) }); break;
      case 'wait-stable': steps.push({ waitStable: Number(value) }); break;
      case 'wait-text': steps.push({ waitText: value }); break;
      case 'wait-id': steps.push({ waitId: value }); break;
      case 'wait-gone-text': steps.push({ waitGoneText: value }); break;
      case 'wait-gone-id': steps.push({ waitGoneId: value }); break;
      case 'shot': steps.push({ shot: value }); break;
      case 'goto': steps.push({ goto: value }); break;
      default: opts[name] = value;
    }
  }
  return { opts, steps };
}

// ---------------------------------------------------------------------------------------------
// servidor
// ---------------------------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isUp(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const pidFile = (port) => resolve(tmpdir(), `sensus-web-${port}.pid`);
const logFile = (port) => resolve(tmpdir(), `sensus-web-${port}.log`);

function stopServer(port) {
  let pid;
  try {
    pid = Number(readFileSync(pidFile(port), 'utf8'));
  } catch {
    return false;
  }
  if (!pid || !pidAlive(pid)) return false;
  try {
    process.kill(-pid, 'SIGTERM'); // grupo de processos (npx -> expo -> metro)
  } catch {
    try { process.kill(pid, 'SIGTERM'); } catch { /* já encerrou */ }
  }
  return true;
}

/** Garante um servidor na porta. Retorna { started } (true se este comando o iniciou). */
async function ensureServer(port, demo) {
  if (await isUp(port)) {
    log(`reaproveitando o servidor em :${port}`);
    return { started: false };
  }
  // Outro shot.mjs pode estar iniciando o servidor nesta porta: espera por ele.
  try {
    const other = Number(readFileSync(pidFile(port), 'utf8'));
    if (other && pidAlive(other)) {
      log(`servidor em :${port} está iniciando (pid ${other}); aguardando`);
      return waitForServer(port, other, false);
    }
  } catch { /* sem pid file */ }

  const out = openSync(logFile(port), 'w');
  const env = { ...process.env, BROWSER: 'none', EXPO_NO_TELEMETRY: '1' };
  if (demo !== undefined) env.EXPO_PUBLIC_SENSUS_DEMO = demo;
  const child = spawn('npx', ['expo', 'start', '--web', '--port', String(port)], {
    cwd: APP_DIR,
    env,
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
  writeFileSync(pidFile(port), String(child.pid));
  log(`iniciando o servidor web em :${port} (pid ${child.pid}; log em ${logFile(port)})`);
  return waitForServer(port, child.pid, true);
}

async function waitForServer(port, pid, started) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await isUp(port)) return { started };
    if (!pidAlive(pid)) {
      let tail = '';
      try { tail = readFileSync(logFile(port), 'utf8').split('\n').slice(-15).join('\n'); } catch { /* sem log */ }
      die(`o servidor Expo encerrou antes de ficar pronto. Fim do log:\n${tail}`);
    }
    await sleep(500);
  }
  die(`o servidor em :${port} não respondeu em 120 s (log: ${logFile(port)})`);
}

// ---------------------------------------------------------------------------------------------
// navegador
// ---------------------------------------------------------------------------------------------

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    die('pacote "playwright" não encontrado. Rode "npm install" na raiz do repositório.');
  }
}

const ERROR_PATTERNS = [
  'Unable to resolve module',
  'Uncaught Error',
  'Render Error',
  'Unmatched Route',
  'Cannot read properties of',
  'Não foi possível abrir o banco de dados',
];
const DB_LOADING_TEXT = 'Preparando o banco de dados';

function stepLabel(step) {
  return JSON.stringify(step);
}

function outPath(p) {
  const abs = resolve(p);
  mkdirSync(dirname(abs), { recursive: true });
  return abs;
}

async function main() {
  const { opts, steps } = parseArgv(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(USAGE);
    return;
  }
  const port = Number(opts.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) die(`--port inválida\n${USAGE}`, 2);
  if (opts.stop) {
    log(stopServer(port) ? `servidor em :${port} encerrado` : `nenhum servidor iniciado por shot.mjs em :${port}`);
    return;
  }

  const scheme = opts.scheme ?? 'light';
  if (scheme !== 'light' && scheme !== 'dark') die('--scheme deve ser light ou dark', 2);
  const route = opts.route ?? '/';
  const finalOut = outPath(opts.out ?? '/tmp/sensus-shot.png');
  const stepTimeout = Number(opts.timeout ?? 15000);
  const navTimeout = Number(opts['nav-timeout'] ?? 120000);
  const settle = Number(opts.settle ?? 400);
  const viewport = { width: Number(opts.width ?? 390), height: Number(opts.height ?? 844) };
  const dpr = Number(opts.dpr ?? 2);

  const { started } = await ensureServer(port, opts.demo);
  const stopOurServer = started && !opts['keep-server'];
  const cleanup = () => {
    if (stopOurServer) stopServer(port);
  };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });

  const { chromium } = await loadPlaywright();
  const shots = [];
  const pageErrors = [];
  const bundleErrors = [];
  let browser;
  let context;
  let exitCode = 0;

  try {
    const contextOptions = {
      viewport,
      deviceScaleFactor: dpr,
      colorScheme: scheme,
      isMobile: true,
      hasTouch: true,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    };
    if (opts.profile) {
      context = await chromium.launchPersistentContext(resolve(opts.profile), { ...contextOptions, headless: true });
    } else {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext(contextOptions);
    }
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(stepTimeout);
    page.setDefaultNavigationTimeout(navTimeout);

    page.on('pageerror', (e) => pageErrors.push(String(e.message ?? e).slice(0, 400)));
    page.on('console', (m) => {
      const type = m.type();
      if (type === 'error' || (opts.verbose && type === 'warning')) {
        const text = m.text().slice(0, 400);
        if (type === 'error') pageErrors.push(text);
        if (opts.verbose) log(`console.${type}: ${text}`);
      }
    });
    page.on('response', (res) => {
      const url = res.url();
      if (res.status() >= 400 && /\.bundle\?/.test(url)) bundleErrors.push({ status: res.status(), url, detail: null });
    });

    const base = `http://localhost:${port}`;
    const open = async (r) => {
      const url = r.startsWith('http') ? r : base + (r.startsWith('/') ? r : `/${r}`);
      log(`abrindo ${url} (${scheme})`);
      await page.goto(url, { waitUntil: 'load' });
      await waitReady(page, navTimeout, opts['ready-text'], bundleErrors);
    };

    await open(route);

    for (const [i, step] of steps.entries()) {
      const timeout = Number(step.timeout ?? stepTimeout);
      try {
        const shot = await runStep(page, step, timeout, open);
        if (shot) shots.push(shot);
      } catch (e) {
        await rescueShot(page, finalOut);
        throw new Error(`passo ${i + 1} ${stepLabel(step)}: ${String(e.message ?? e).split('\n')[0]}`);
      }
    }

    await sleep(settle);
    const target = opts.element ? page.getByTestId(opts.element).first() : page;
    await (opts.element ? target.screenshot({ path: finalOut }) : page.screenshot({ path: finalOut, fullPage: !!opts['full-page'] }));
    shots.push(finalOut);

    // Diagnóstico: tela de erro e erros de bundle.
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const screenError = ERROR_PATTERNS.find((p) => bodyText.includes(p));
    if (bundleErrors.length) {
      log(`falha no bundle:\n${await bundleErrorDetail(bundleErrors[0])}`);
      exitCode = opts['allow-errors'] ? exitCode : 1;
    }
    if (screenError) {
      log(`a tela mostra um erro ("${screenError}"). Texto:\n${bodyText.slice(0, 600)}`);
      exitCode = opts['allow-errors'] ? exitCode : 1;
    }
    if (pageErrors.length) {
      const uniq = [...new Set(pageErrors)].slice(0, 8);
      log(`${pageErrors.length} erro(s) no console/página:\n  - ${uniq.join('\n  - ')}`);
    }
  } catch (e) {
    exitCode = 1;
    console.error(`[shot] ERRO: ${String(e.message ?? e).split('\n').slice(0, 6).join('\n')}`);
    if (pageErrors.length) console.error(`[shot] erros de página: ${[...new Set(pageErrors)].slice(0, 5).join(' | ')}`);
    try { logTailHint(port, started); } catch { /* ignore */ }
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    cleanup();
  }

  for (const s of shots) process.stdout.write(`${s}\n`);
  process.exit(exitCode);
}

function logTailHint(port, started) {
  if (started) console.error(`[shot] log do servidor: ${logFile(port)}`);
}

/** Salva uma captura do estado atual quando um passo falha, para depuração. */
async function rescueShot(page, finalOut) {
  const path = finalOut.replace(/\.png$/i, '') + '.error.png';
  try {
    await page.screenshot({ path });
    console.error(`[shot] captura do estado no momento da falha: ${path}`);
  } catch { /* página já fechada */ }
}

/** Detalhe do erro de bundle do Metro (corpo JSON do 500), buscado direto, pois o navegador o descarta. */
async function bundleErrorDetail(entry) {
  if (entry.detail !== null) return entry.detail;
  try {
    const res = await fetch(entry.url, { signal: AbortSignal.timeout(60_000) });
    const body = await res.text();
    try {
      const j = JSON.parse(body);
      entry.detail = [j.message, ...(j.errors ?? []).map((e) => e.description)].filter(Boolean).join('\n').slice(0, 1500);
    } catch {
      entry.detail = body.slice(0, 1500);
    }
  } catch (e) {
    entry.detail = `(não consegui obter o detalhe: ${e.message})`;
  }
  return entry.detail;
}

/** Espera o banco abrir (some o aviso de carregamento) e, opcionalmente, um texto. Falha cedo se o bundle quebrar. */
async function waitReady(page, navTimeout, readyText, bundleErrors) {
  const deadline = Date.now() + navTimeout;
  for (;;) {
    if (bundleErrors.length) {
      const first = bundleErrors[0];
      throw new Error(`o bundle falhou (HTTP ${first.status}):\n${await bundleErrorDetail(first)}`);
    }
    const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
    if (ERROR_PATTERNS.some((p) => text.includes(p))) break; // erro de app: tratado no diagnóstico final
    if (text.trim().length > 0 && !text.includes(DB_LOADING_TEXT)) break;
    if (Date.now() > deadline) throw new Error(`o app não terminou de carregar em ${navTimeout} ms (banco/bundle?)`);
    await sleep(250);
  }
  if (readyText) await page.getByText(readyText).first().waitFor({ state: 'visible', timeout: navTimeout });
  // O primeiro render pode ainda estar lendo o banco: espera a rede acalmar (best effort).
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
}

async function runStep(page, step, timeout, open) {
  const opt = { timeout };
  const text = (t) => page.getByText(t, { exact: !!step.exact }).nth(Number(step.nth ?? 0));
  const id = (t) => page.getByTestId(t).nth(Number(step.nth ?? 0));

  if ('tap' in step) {
    const loc = id(step.tap);
    await loc.waitFor({ state: 'visible', ...opt });
    await loc.click(opt);
    return null;
  }
  if ('tapText' in step) {
    const loc = text(step.tapText);
    await loc.waitFor({ state: 'visible', ...opt });
    await loc.click(opt);
    return null;
  }
  if ('type' in step) {
    const loc = id(step.type);
    await loc.waitFor({ state: 'visible', ...opt });
    if (step.slow) {
      await loc.click(opt);
      await loc.pressSequentially(String(step.text ?? ''), { delay: 40 });
    } else {
      await loc.fill(String(step.text ?? ''), opt);
    }
    return null;
  }
  if ('press' in step) {
    await page.keyboard.press(String(step.press));
    return null;
  }
  if ('scroll' in step) {
    const by = step.by !== undefined ? Number(step.by) : step.to === 'bottom' ? 30000 : step.to === 'top' ? -30000 : NaN;
    if (Number.isNaN(by)) throw new Error('scroll exige "by" (px) ou "to" ("top"|"bottom")');
    if (step.scroll === 'page') {
      const vp = page.viewportSize();
      await page.mouse.move(vp.width / 2, vp.height / 2);
      // wheel em fatias: rolagens grandes de uma vez são limitadas pelo Chromium
      let left = by;
      while (Math.abs(left) > 0) {
        const d = Math.sign(left) * Math.min(Math.abs(left), 1200);
        await page.mouse.wheel(0, d);
        left -= d;
        await sleep(60);
      }
    } else {
      const loc = id(step.scroll);
      await loc.waitFor({ state: 'attached', ...opt });
      await loc.evaluate((el, dy) => {
        // O testID pode estar num contêiner; rola o próprio elemento ou o primeiro descendente rolável.
        const scrollable = (n) => n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY);
        const target = scrollable(el) ? el : [...el.querySelectorAll('*')].find(scrollable) ?? el;
        target.scrollBy({ top: dy, behavior: 'instant' });
      }, by);
    }
    await sleep(250);
    return null;
  }
  if ('waitText' in step) {
    await text(step.waitText).waitFor({ state: 'visible', ...opt });
    return null;
  }
  if ('waitId' in step) {
    await id(step.waitId).waitFor({ state: 'visible', ...opt });
    return null;
  }
  if ('waitGoneText' in step) {
    await text(step.waitGoneText).waitFor({ state: 'hidden', ...opt });
    return null;
  }
  if ('waitGoneId' in step) {
    await id(step.waitGoneId).waitFor({ state: 'hidden', ...opt });
    return null;
  }
  if ('wait' in step) {
    await sleep(Number(step.wait));
    return null;
  }
  if ('waitStable' in step) {
    // Espera o texto da página parar de mudar por N ms (ex.: fim de um stream da IA).
    const quiet = Number(step.waitStable);
    const deadline = Date.now() + timeout;
    let last = null;
    let since = Date.now();
    for (;;) {
      const now = await page.evaluate(() => document.body.innerText);
      if (now !== last) {
        last = now;
        since = Date.now();
      } else if (Date.now() - since >= quiet) {
        return null;
      }
      if (Date.now() > deadline) throw new Error(`o conteúdo continuou mudando por ${timeout} ms`);
      await sleep(100);
    }
  }
  if ('goto' in step) {
    await open(String(step.goto));
    return null;
  }
  if ('shot' in step) {
    const path = outPath(String(step.shot));
    if (step.element) await id(step.element).screenshot({ path });
    else await page.screenshot({ path, fullPage: !!step.fullPage });
    return path;
  }
  throw new Error(`passo desconhecido: ${stepLabel(step)}`);
}

main().catch((e) => {
  console.error(`[shot] ERRO inesperado: ${e?.stack ?? e}`);
  process.exit(1);
});
