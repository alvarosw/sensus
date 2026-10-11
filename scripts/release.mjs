#!/usr/bin/env node
// Rotinas de release do Sensus. Uso na raiz do repositório (ver docs/RELEASING.md):
//   npm run release:version -- 1.0.1          grava a versão em app/app.config.ts e app/package.json
//   npm run release:check [-- <apk>]          testes, typecheck e (se houver APK) varredura de segredos
//   npm run release:android [-- preview|emulator]  build Android local com EAS -> dist/sensus-<versão>[-perfil].apk
//                                             (production: só arm64-v8a; emulator: só x86_64, para QA)
//   npm run release:ios                       build iOS na nuvem EAS (simulador), imprime o link
//   npm run release:github [-- --run]         imprime (ou, com --run, executa) o gh release create
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');
const DIST = join(ROOT, 'dist');
const APP_CONFIG = join(APP, 'app.config.ts');
const APP_PACKAGE = join(APP, 'package.json');
const CHECK_APK = join(APP, 'scripts', 'check-apk-secrets.sh');
const EASIGNORE = join(ROOT, '.easignore');
const DB_ASSET = 'app/assets/sensus.db'; // banco de leitura empacotado no APK (gitignored; ver sync-db)
const SEMVER = /^\d+\.\d+\.\d+$/;
const VERSION_LINE = /^const APP_VERSION = '(\d+\.\d+\.\d+)';$/m;
const PROFILES = ['production', 'preview', 'emulator'];

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

/** Versão de release: a constante APP_VERSION de app/app.config.ts (fonte da verdade). */
function readVersion() {
  const match = VERSION_LINE.exec(readFileSync(APP_CONFIG, 'utf8'));
  if (!match) fail(`não achei "const APP_VERSION = 'x.y.z';" em ${APP_CONFIG}`);
  return match[1];
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** Roda um comando herdando o terminal; sai com erro se falhar. */
function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  // Lança (não sai do processo) para que os `finally` de limpeza sempre rodem.
  if (result.error) throw new Error(`${cmd}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} terminou com código ${result.status}`);
}

function requireEas() {
  const probe = spawnSync('eas', ['--version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    fail('EAS CLI não encontrado. Instale uma vez com: npm i -g eas-cli   (e depois: eas login)');
  }
}

function version(args) {
  const next = args[0];
  if (!next || !SEMVER.test(next)) fail('uso: npm run release:version -- <x.y.z>');
  const config = readFileSync(APP_CONFIG, 'utf8');
  if (!VERSION_LINE.test(config)) fail(`não achei "const APP_VERSION = 'x.y.z';" em ${APP_CONFIG}`);
  writeFileSync(APP_CONFIG, config.replace(VERSION_LINE, `const APP_VERSION = '${next}';`));
  const pkg = JSON.parse(readFileSync(APP_PACKAGE, 'utf8'));
  pkg.version = next;
  writeFileSync(APP_PACKAGE, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`versão: ${next} (app/app.config.ts e app/package.json)`);
  console.log('Lembrete: commite a mudança antes de gerar o build de release.');
}

function check(args) {
  console.log('== testes ==');
  run('npx', ['vitest', 'run'], { cwd: ROOT });
  console.log('== typecheck (núcleo) ==');
  run('npx', ['tsc', '-p', 'packages/core', '--noEmit'], { cwd: ROOT });
  console.log('== typecheck (app) ==');
  run('npx', ['tsc', '--noEmit'], { cwd: APP });

  const v = readVersion();
  const apk = args[0] ? resolve(ROOT, args[0]) : join(DIST, `sensus-${v}.apk`);
  if (existsSync(apk)) {
    console.log(`== segredos no APK: ${apk} ==`);
    run('bash', [CHECK_APK, apk]);
  } else {
    console.log(`(sem APK em ${apk}: varredura de segredos pulada; rode depois de release:android)`);
  }
  console.log('release:check OK');
}

/** Restaura um arquivo ao conteúdo de antes do build (o prebuild pode reescrever app/package.json). */
function snapshot(file) {
  const content = readFileSync(file, 'utf8');
  return () => writeFileSync(file, content);
}

/**
 * O EAS monta o arquivo do build a partir dos .gitignore, o que deixaria de fora o banco de leitura
 * (app/assets/sensus.db, gitignored e necessário ao bundle). Com um .easignore, o EAS usa só ele: então
 * listamos exatamente os caminhos que o git ignora, menos o banco. Assim nada extra entra no arquivo
 * (inclusive .env) e o banco entra. O arquivo é temporário e removido ao fim do build.
 */
function writeEasignore() {
  const listed = spawnSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (listed.status !== 0) fail('git ls-files falhou ao montar o .easignore temporário');
  const paths = listed.stdout.split('\n').filter(Boolean);
  const parent = paths.find((p) => p.endsWith('/') && DB_ASSET.startsWith(p));
  if (parent) fail(`o diretório ${parent} foi listado inteiro e esconderia o banco; ajuste o script.`);
  if (!paths.includes(DB_ASSET)) fail(`${DB_ASSET} não aparece como ignorado; confira o .gitignore.`);
  // Ancorado na raiz ("/"): sem barra, "data/" casaria também com app/src/data/ (código-fonte).
  const lines = paths.filter((p) => p !== DB_ASSET).map((p) => `/${p}`);
  writeFileSync(EASIGNORE, `${lines.join('\n')}\n`);
}

function android(args) {
  const profile = args[0] ?? 'production';
  if (!PROFILES.includes(profile)) fail(`perfil desconhecido "${profile}" (use: ${PROFILES.join(', ')})`);
  requireEas();
  const v = readVersion();
  const target = profile === 'production' ? join(DIST, `sensus-${v}.apk`) : join(DIST, `sensus-${v}-${profile}.apk`);
  mkdirSync(DIST, { recursive: true });
  if (!process.env.ANDROID_HOME && existsSync(join(process.env.HOME ?? '', 'Android', 'Sdk'))) {
    process.env.ANDROID_HOME = join(process.env.HOME, 'Android', 'Sdk');
  }
  // O build local trabalha em TMPDIR (o /tmp costuma ser tmpfs pequeno; o NDK estoura o espaço).
  if (!process.env.TMPDIR) {
    process.env.TMPDIR = join(process.env.HOME ?? ROOT, '.cache', 'sensus-release-tmp');
    mkdirSync(process.env.TMPDIR, { recursive: true });
  }

  const restorePackage = snapshot(APP_PACKAGE);
  try {
    writeEasignore();
    // Build local (sem cota de nuvem). Keystore: gerenciado pelo EAS (credentialsSource: remote).
    run('eas', ['build', '--platform', 'android', '--profile', profile, '--local', '--non-interactive', '--output', target], {
      cwd: APP,
    });
  } finally {
    rmSync(EASIGNORE, { force: true });
    restorePackage();
  }

  if (!existsSync(target)) fail(`o build terminou sem gerar ${target}`);
  const scan = spawnSync('bash', [CHECK_APK, target], { stdio: 'inherit' });
  if (scan.status !== 0) {
    rmSync(target, { force: true });
    fail('o APK tem segredos de desenvolvimento; apagado de dist/. Veja docs/RELEASING.md.');
  }
  console.log(`APK: ${target}`);
  console.log(`SHA-256: ${sha256(target)}`);
}

function ios() {
  requireEas();
  const result = spawnSync(
    'eas',
    ['build', '--platform', 'ios', '--profile', 'production', '--non-interactive', '--no-wait'],
    { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 16 * 1024 * 1024 },
  );
  process.stdout.write(result.stdout ?? '');
  if (result.error) fail(`eas: ${result.error.message}`);
  if (result.status !== 0) fail(`eas build terminou com código ${result.status}`);
  const links = [...(result.stdout ?? '').matchAll(/https:\/\/expo\.dev\/\S+/g)].map((m) => m[0]);
  console.log(links.length ? `Build iOS (simulador, na nuvem): ${links.at(-1)}` : 'Build enviado; o link está na saída acima.');
  console.log('Quando terminar: npx eas-cli build:run -p ios --latest  (instala no simulador booted)');
}

function github(args) {
  const v = readVersion();
  const apk = join(DIST, `sensus-${v}.apk`);
  if (!existsSync(apk)) fail(`não achei ${apk}; rode npm run release:android antes.`);
  const notes = join(DIST, `release-notes-${v}.md`);
  writeFileSync(
    notes,
    [
      `Sensus ${v}: APK para instalação direta no Android (build local com EAS).`,
      '',
      `SHA-256 do APK: \`${sha256(apk)}\``,
      '',
      'Os dados de estudo são baixados pelo app na primeira abertura. Atribuições: DATA_LICENSES.md.',
      '',
    ].join('\n'),
  );
  const cmd = ['release', 'create', `v${v}`, apk, '--title', `Sensus ${v}`, '--notes-file', notes];
  if (args.includes('--run')) {
    run('gh', cmd, { cwd: ROOT });
  } else {
    console.log('Comando (rode você, ou repita com -- --run):');
    console.log(`  gh ${cmd.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`);
  }
}

const [command, ...rest] = process.argv.slice(2);
const commands = { version, check, android, ios, github };
if (!commands[command]) {
  console.log('uso: release.mjs <version|check|android|ios|github> [args]');
  process.exit(command ? 1 : 0);
}
try {
  commands[command](rest);
} catch (error) {
  console.error(`release: ${error.message}`);
  process.exit(1);
}
