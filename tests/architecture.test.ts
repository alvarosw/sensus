// Guarda de arquitetura (docs/ARCHITECTURE.md): camadas, ciclos entre features, acesso a outra feature só pelo
// index.ts e literais de domínio fora de packages/core/src/domain e repo. As violações que já existiam ficam em
// architecture-exceptions.ts; a lista só diminui: violação nova falha, exceção que deixou de existir também
// (apague-a do arquivo). Para regerar a lista depois de uma migração: UPDATE_ARCH_EXCEPTIONS=1 npx vitest run tests.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ARCH_EXCEPTIONS } from './architecture-exceptions';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app', 'src');
const CORE = join(ROOT, 'packages', 'core', 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => relative(ROOT, p).split(sep).join('/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p);

// ---- camadas -------------------------------------------------------------------------------------------

type Layer =
  | 'core-domain'
  | 'core'
  | 'app-design'
  | 'app-i18n'
  | 'app-data'
  | 'app-service'
  | 'app-common'
  | 'app-feature'
  | 'app-routes'
  | 'app-dev'
  | 'app-other';

const RANK: Record<Layer, number> = {
  'core-domain': 0,
  core: 1,
  'app-design': 2,
  'app-i18n': 2,
  'app-data': 3,
  'app-service': 4,
  'app-common': 5,
  'app-feature': 6,
  'app-routes': 7,
  'app-dev': 2,
  'app-other': 7,
};

function layerOf(file: string): { layer: Layer; feature?: string } {
  const r = rel(file);
  if (r.startsWith('packages/core/src/domain/')) return { layer: 'core-domain' };
  if (r.startsWith('packages/core/')) return { layer: 'core' };
  // dados de demonstração gravados (fixtures da IA): só dados, abaixo dos serviços
  if (r.startsWith('app/dev/')) return { layer: 'app-dev' };
  const m = /^app\/src\/([^/]+)(?:\/([^/]+))?/.exec(r);
  if (!m) return { layer: 'app-other' };
  const [, top, sub] = m;
  if (top === 'design' || top === 'ui') return { layer: 'app-design' };
  if (top === 'i18n') return { layer: 'app-i18n' };
  if (top === 'data') return { layer: 'app-data' };
  if (['translate', 'settings', 'state', 'ai', 'auth'].includes(top!)) return { layer: 'app-service' };
  if (top === 'features') {
    if (sub === 'common') return { layer: 'app-common' };
    return { layer: 'app-feature', feature: sub };
  }
  if (top === 'app') return { layer: 'app-routes' };
  return { layer: 'app-other' };
}

// ---- imports -------------------------------------------------------------------------------------------

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

function resolveImport(from: string, spec: string): string | null {
  let base: string | null = null;
  if (spec.startsWith('@/')) base = join(APP, spec.slice(2));
  else if (spec === '@sensus/core' || spec.startsWith('@sensus/core/')) base = join(CORE, spec.slice('@sensus/core'.length) || 'index');
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  if (!base) return null;
  for (const ext of EXTS) {
    try {
      // só código conta como dependência; assets (ex.: app/assets/sensus.db, local e fora do git) não
      if (statSync(base + ext).isFile()) return /\.tsx?$/.test(base + ext) ? base + ext : null;
    } catch {
      /* tenta a próxima extensão */
    }
  }
  return null;
}

interface Violation {
  rule: string;
  file: string;
  detail: string;
}
const key = (v: Violation) => `${v.rule} | ${v.file} | ${v.detail}`;

function collect(): Violation[] {
  const files = [...walk(APP), ...walk(CORE)];
  const out: Violation[] = [];
  const featureEdges = new Map<string, Set<string>>();

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const from = layerOf(file);
    const r = rel(file);
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3]!;
      // o núcleo não conhece React, Expo nem o app
      if (from.layer === 'core' || from.layer === 'core-domain') {
        if (/^(react|react-native|expo)(\/|$)/.test(spec) || spec.startsWith('@/')) {
          out.push({ rule: 'core-sem-app', file: r, detail: spec });
        }
      }
      const target = resolveImport(file, spec);
      if (!target) continue;
      const to = layerOf(target);
      const tr = rel(target);
      // domínio só pode importar types.ts e refs.ts do núcleo (já verificado acima; por isso não cai em 'camada')
      if (from.layer === 'core-domain' && to.layer === 'core') {
        const ok = /packages\/core\/src\/(types|refs)\.ts$/.test(tr);
        if (!ok) out.push({ rule: 'dominio-isolado', file: r, detail: tr });
      } else if (RANK[to.layer] > RANK[from.layer]) {
        out.push({ rule: 'camada', file: r, detail: tr });
      }
      if (from.layer === 'app-feature' && to.layer === 'app-feature' && from.feature !== to.feature) {
        if (!new RegExp(`^app/src/features/${to.feature}/index\\.tsx?$`).test(tr)) {
          out.push({ rule: 'feature-por-index', file: r, detail: tr });
        }
        if (!isTest(file)) {
          const set = featureEdges.get(from.feature!) ?? new Set<string>();
          set.add(to.feature!);
          featureEdges.set(from.feature!, set);
        }
      }
    }
    out.push(...literalViolations(file, src));
  }

  // ciclos entre features (pares; ciclos maiores aparecem como pares ao longo do caminho)
  for (const [a, tos] of featureEdges) {
    for (const b of tos) {
      if (a < b && featureEdges.get(b)?.has(a)) out.push({ rule: 'ciclo-features', file: `features/${a}`, detail: `features/${b}` });
    }
  }
  return out;
}

// ---- literais de domínio -------------------------------------------------------------------------------

const LITERALS: Array<{ name: string; re: RegExp }> = [
  { name: "startsWith('H'|'G')", re: /\.startsWith\(\s*['"][HG]['"]\s*\)/ },
  { name: "corpus 'gnt'|'hot'", re: /['"](gnt|hot)['"]/ },
  { name: 'vid % 1000', re: /%\s*1000\b/ },
  { name: 'vid * 1_000_000', re: /\*\s*1_?000_?000\b/ },
  { name: "fonte 'stepbible-*'", re: /['"]stepbible-[a-z]+['"]/ },
  { name: "léxico 'tbesg'|'tbesh'", re: /['"](tbesg|tbesh)['"]/i },
  { name: "texto 'no NT'|'no AT'", re: /no (NT|AT)\b/ },
];

function literalAllowed(file: string): boolean {
  const r = rel(file);
  return r.startsWith('packages/core/src/domain/') || /^packages\/core\/src\/repo(\/|\.ts$)/.test(r) || isTest(file);
}

function literalViolations(file: string, src: string): Violation[] {
  if (literalAllowed(file)) return [];
  const out: Violation[] = [];
  const lines = src.split('\n');
  for (const { name, re } of LITERALS) {
    const count = lines.filter((l) => !/^\s*(\/\/|\*)/.test(l) && re.test(l)).length;
    if (count > 0) out.push({ rule: 'literal-dominio', file: rel(file), detail: `${name} ×${count}` });
  }
  return out;
}

// ---- teste ---------------------------------------------------------------------------------------------

describe('arquitetura (docs/ARCHITECTURE.md)', () => {
  const found = collect();
  const foundKeys = new Set(found.map(key));

  if (process.env.UPDATE_ARCH_EXCEPTIONS) {
    const sorted = [...foundKeys].sort();
    writeFileSync(
      join(ROOT, 'tests', 'architecture-exceptions.ts'),
      `// Violações de arquitetura que já existiam. Esta lista só diminui (ver tests/architecture.test.ts).\n` +
        `// Formato: "regra | arquivo | detalhe". Gerada com UPDATE_ARCH_EXCEPTIONS=1; nunca acrescente à mão.\n` +
        `export const ARCH_EXCEPTIONS: readonly string[] = ${JSON.stringify(sorted, null, 2)};\n`,
    );
  }

  it('não há violação nova', () => {
    const allowed = new Set(ARCH_EXCEPTIONS);
    const fresh = [...foundKeys].filter((k) => !allowed.has(k)).sort();
    expect(fresh, 'Violação nova de arquitetura. Corrija em vez de acrescentar à lista de exceções.').toEqual([]);
  });

  it('a lista de exceções não tem itens já resolvidos', () => {
    const stale = ARCH_EXCEPTIONS.filter((k) => !foundKeys.has(k));
    expect(stale, 'Exceções já resolvidas: apague-as de tests/architecture-exceptions.ts.').toEqual([]);
  });
});
