// Grava respostas REAIS do modelo (NVIDIA, via .env da raiz) como fixtures para o provedor de
// demonstração (src/ai/demo-provider.ts). Rode uma vez; os arquivos vão para dev/fixtures/ e são
// versionados.
//
//   cd app && npx tsx scripts/record-fixtures.ts            grava o que ainda não existe
//   cd app && npx tsx scripts/record-fixtures.ts --force    regrava tudo
//   cd app && npx tsx scripts/record-fixtures.ts --only "Phil 2:5-8"
//   cd app && npx tsx scripts/record-fixtures.ts --index    só regenera dev/fixtures/index.ts
//
// Para cada intervalo: o resumo, o aprofundamento das seções 'lingua' e 'interpretacao' e as
// respostas a 2 das perguntas sugeridas pelo próprio resumo. O texto bruto do modelo é guardado
// (marcadores @secao e [[cite_id]] incluídos). Nunca imprime a chave da API.
//
// O contexto é montado exatamente como o app faz (buildPanel padrão + serializePanel), para que os
// cite_ids gravados existam no contexto que o app envia.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { config as loadEnv } from 'dotenv';
import {
  answerMessages,
  buildPanel,
  buildProviderConfig,
  buildRichTextContext,
  CHAT_MAX_TOKENS,
  OpenAICompatibleProvider,
  parseRef,
  parseStructuredSummary,
  Repo,
  sectionMessages,
  serializePanel,
  SUMMARY_MAX_TOKENS,
  summaryMessages,
  type ChatMessage,
  type SectionKey,
  type SqlDriver,
  type SqlParam,
  type VerseRange,
} from '@sensus/core';
import type { Fixture, FixtureKind } from '../dev/fixtures/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const ROOT = resolve(APP, '..');
const OUT = resolve(APP, 'dev', 'fixtures');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

const DB_PATH = process.env.SENSUS_DB ? resolve(process.env.SENSUS_DB) : resolve(APP, 'assets', 'sensus.db');
const REFERENCES = ['Phil 2:5-8', 'Phil 1:27-2:4'];
const SECTIONS: SectionKey[] = ['lingua', 'interpretacao'];
const QUESTIONS_PER_RANGE = 2;
const LANGUAGE = 'pt-BR'; // APP_LOCALE do app

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function fileFor(reference: string, kind: FixtureKind, suffix?: string): string {
  const parts = [slug(reference), kind, suffix].filter(Boolean);
  return resolve(OUT, `${parts.join('.')}.json`);
}

async function collect(
  provider: OpenAICompatibleProvider,
  messages: ChatMessage[],
  maxTokens: number,
  label: string,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let text = '';
    try {
      for await (const piece of provider.stream({ messages, temperature: 0.2, maxTokens })) text += piece;
      if (!/^\s*(?:#{1,6}\s*)?(?:\*\*)?@fim/m.test(text)) {
        console.warn(`  ! ${label}: sem @fim (tentativa ${attempt}); ${text.length} caracteres`);
        if (attempt < 3) continue;
      }
      return text;
    } catch (e) {
      lastErr = e;
      console.warn(`  ! ${label}: falha (tentativa ${attempt}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label}: falha ao gravar`);
}

function save(path: string, fixture: Fixture): void {
  writeFileSync(path, JSON.stringify(fixture, null, 2) + '\n');
  console.log(`  ok ${path.slice(APP.length + 1)} (${fixture.text.length} caracteres)`);
  writeIndex();
}

/** Gera dev/fixtures/index.ts com imports estáticos (o Metro não faz glob). */
function writeIndex(): void {
  const files = readdirSync(OUT)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const ident = (f: string, i: number) => `f${i}`;
  const lines = [
    '// GERADO por scripts/record-fixtures.ts — não editar à mão.',
    "import type { Fixture } from './types';",
    ...files.map((f, i) => `import ${ident(f, i)} from './${f}';`),
    '',
    `export const FIXTURES: readonly Fixture[] = [${files.map(ident).join(', ')}] as unknown as Fixture[];`,
    '',
  ];
  writeFileSync(resolve(OUT, 'index.ts'), lines.join('\n'));
  console.log(`  index.ts atualizado (${files.length} fixtures)`);
}

async function main(): Promise<void> {
  if (args.includes('--index')) {
    writeIndex(); // só regenera dev/fixtures/index.ts a partir dos JSON existentes
    return;
  }
  const cfg = buildProviderConfig('nvidia', {
    apiKey: process.env.NVIDIA_API_KEY ?? '',
    baseUrl: process.env.NVIDIA_BASE_URL,
    model: process.env.NVIDIA_MODEL,
  });
  if (!cfg.apiKey || !cfg.model) {
    console.error('NVIDIA_API_KEY/NVIDIA_MODEL ausentes no .env da raiz do repositório.');
    process.exit(1);
  }
  if (!existsSync(DB_PATH)) {
    console.error(`Banco não encontrado: ${DB_PATH}`);
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });

  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const driver: SqlDriver = {
    async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as unknown as T[];
    },
  };
  const repo = new Repo(driver);
  const provider = new OpenAICompatibleProvider(cfg, fetch);

  try {
    const books = await repo.books();
    for (const ref of REFERENCES) {
      if (only && only !== ref) continue;
      const range = parseRef(ref, books);
      if (!range) throw new Error(`Referência não reconhecida: ${ref}`);
      const panel = await buildPanel(repo, range);
      const context = serializePanel(panel);
      const rich = buildRichTextContext(context, panel, books);
      const reference = panel.reference;
      console.log(`\n${reference} (${context.text.length} caracteres de contexto, ${context.citeIds.size} cite_ids)`);

      const base = { version: 1 as const, reference, range, model: cfg.model, recordedAt: new Date().toISOString() };

      // 1) resumo
      const summaryPath = fileFor(reference, 'summary');
      let summaryText: string;
      if (!force && existsSync(summaryPath)) {
        summaryText = (JSON.parse(readFileSync(summaryPath, 'utf8')) as Fixture).text;
        console.log('  = resumo já gravado');
      } else {
        console.log('  gravando resumo...');
        summaryText = await collect(provider, summaryMessages(context, { language: LANGUAGE }), SUMMARY_MAX_TOKENS, 'resumo');
        save(summaryPath, { ...base, kind: 'summary', text: summaryText });
      }

      // 2) aprofundamentos
      for (const section of SECTIONS) {
        const path = fileFor(reference, 'section', section);
        if (!force && existsSync(path)) {
          console.log(`  = seção ${section} já gravada`);
          continue;
        }
        console.log(`  gravando seção ${section}...`);
        const text = await collect(
          provider,
          sectionMessages(context, section, { language: LANGUAGE }),
          SUMMARY_MAX_TOKENS,
          `seção ${section}`,
        );
        save(path, { ...base, kind: 'section', section, text });
      }

      // 3) respostas a perguntas sugeridas pelo resumo
      const questions = parseStructuredSummary(summaryText, rich).questions.slice(0, QUESTIONS_PER_RANGE);
      if (questions.length === 0) console.warn('  ! o resumo não trouxe perguntas sugeridas');
      for (const [i, question] of questions.entries()) {
        const path = fileFor(reference, 'answer', String(i + 1));
        if (!force && existsSync(path)) {
          console.log(`  = resposta ${i + 1} já gravada`);
          continue;
        }
        console.log(`  gravando resposta ${i + 1}: ${question}`);
        const text = await collect(
          provider,
          answerMessages(context, [], question, { language: LANGUAGE }),
          CHAT_MAX_TOKENS,
          `resposta ${i + 1}`,
        );
        save(path, { ...base, kind: 'answer', question, text });
      }
    }
    writeIndex();
  } finally {
    db.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
