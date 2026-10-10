// CLI de teste ponta a ponta, sem celular.
//   npm run ask -- "Phil 2:5-8"                    resumo estruturado (visão, seções, perguntas)
//   npm run ask -- "Phil 2:5-8" --section texto    aprofunda uma seção (texto, literario, historico,
//                                                  lingua, intertexto, interpretacao, aplicacao)
//   npm run ask -- "Phil 2:5-8" "sua pergunta"     resposta com base no contexto
//   npm run ask -- "Phil 2:5-8" --context          só imprime o contexto serializado
//   npm run ask -- --list-models                   lista os modelos do provedor (NVIDIA_*)
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { config as loadEnv } from 'dotenv';
import {
  answerMessages,
  blocksToPlainText,
  buildPanel,
  buildProviderConfig,
  buildRichTextContext,
  CHAT_MAX_TOKENS,
  claimsOf,
  DEFAULT_PANEL_LIMITS,
  OpenAICompatibleProvider,
  parseRef,
  parseStructuredAnswer,
  parseStructuredSummary,
  Repo,
  SECTION_KEYS,
  SECTION_LABELS,
  sectionMessages,
  serializePanel,
  SUMMARY_MAX_TOKENS,
  summaryMessages,
  type Block,
  type PanelData,
  type RichTextContext,
  type SectionKey,
  type SqlDriver,
  type SqlParam,
  type StructuredAnswer,
  type StructuredSummary,
} from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/core/tools -> raiz do repositório
const ROOT = resolve(HERE, '..', '..', '..');
loadEnv({ path: resolve(ROOT, '.env') });

const CONTEXT_BUDGET = 60_000;
/** data/sensus.db na raiz; SENSUS_DB aponta para outro arquivo (ex.: um banco de teste). */
const DB_PATH = process.env.SENSUS_DB ? resolve(process.env.SENSUS_DB) : resolve(ROOT, 'data', 'sensus.db');

function usage(): void {
  console.error('Uso: npm run ask -- "<referência>" [pergunta] [--section <chave>] [--context]');
  console.error('     npm run ask -- --list-models');
  console.error(`Seções: ${SECTION_KEYS.join(', ')}`);
  console.error('Exemplos: "Phil 2:5-8", "Filipenses 2", "Rom 8:28-30"');
}

function providerFromEnv(env: NodeJS.ProcessEnv) {
  return buildProviderConfig('nvidia', {
    apiKey: env.NVIDIA_API_KEY ?? '',
    baseUrl: env.NVIDIA_BASE_URL,
    model: env.NVIDIA_MODEL,
  });
}

function printStats(panel: PanelData): void {
  const l = panel.layers;
  const sourceCount = Object.keys(panel.sources).length;
  console.log(`Passagem: ${panel.reference}  (vid ${panel.range.start} – ${panel.range.end})`);
  console.log(`  1 Texto:          ${l.text.translations.length} versículos de tradução, ${l.text.original.length} palavras, ${l.text.variants.length} variantes`);
  console.log(`  2 Literário:      ${l.literary.before.length} antes, ${l.literary.after.length} depois, ${l.literary.divisions.length} divisões, ${l.literary.bookIntro.length} intro. do livro`);
  console.log(`  3 Histórico:      ${l.historical.entities.length} entidades, ${l.historical.dictionary.length} verbetes`);
  console.log(`  4 Língua:         ${l.language.lexicon.length} verbetes de léxico, ${Object.keys(l.language.concordance).length} strong_base com concordância`);
  console.log(`  5 Intertexto:     ${l.intertext.xrefs.length} referências cruzadas, ${l.intertext.topics.length} temas`);
  console.log(`  6 Interpretação:  ${l.interpretation.commentaries.length} comentários`);
  console.log(`  Fontes usadas:    ${sourceCount}`);
  console.log('');
}

/** Contagens de citações e de frases sem citação nos blocos (inclusive itens de lista). */
function citationStats(blocks: readonly Block[]): { valid: number; invalid: string[]; distinct: Set<string> } {
  const stats = { valid: 0, invalid: [] as string[], distinct: new Set<string>() };
  const visit = (inlines: readonly { type: string; refs?: Array<{ citeId: string; valid: boolean; citeIds?: string[] }> }[]) => {
    for (const inl of inlines) {
      if (inl.type !== 'cite' || !inl.refs) continue;
      for (const r of inl.refs) {
        if (r.valid) {
          stats.valid += 1;
          for (const id of r.citeIds ?? [r.citeId]) stats.distinct.add(id);
        } else {
          stats.invalid.push(r.citeId);
        }
      }
    }
  };
  for (const b of blocks) {
    if (b.type === 'list') for (const item of b.items) visit(item.inlines);
    else visit(b.inlines);
  }
  return stats;
}

/** Validação: classificação dos blocos, citações, frases sem citação e conflitos morfológicos. */
function printValidation(blocks: readonly Block[], validCount: number, complete: boolean): void {
  const claims = claimsOf(blocks);
  const count = (kind: string) => claims.filter((c) => c.kind === kind).length;
  const stats = citationStats(blocks);
  const uncited = claims.flatMap((c) => c.uncited);
  const conflicts = claims.flatMap((c) => c.morphConflicts.map((m) => ({ ...m })));

  console.log('\n--- Validação ---');
  console.log(
    `Blocos: ${claims.length} (${count('source')} com fonte, ${count('inference')} inferências, ${count('mixed')} mistos, ${count('structure')} estrutura)`,
  );
  console.log(
    `Citações: ${stats.valid} válidas (${stats.distinct.size} distintas, de ${validCount} disponíveis), ${stats.invalid.length} inválidas`,
  );
  if (stats.invalid.length > 0) {
    console.log('Inválidas:');
    for (const id of [...new Set(stats.invalid)]) console.log(`  - ${id}`);
  }
  console.log(`Frases sem citação: ${uncited.length}`);
  for (const t of uncited.slice(0, 6)) console.log(`  - ${t.slice(0, 140)}`);
  console.log(`Conflitos morfológicos: ${conflicts.length}`);
  for (const c of conflicts) console.log(`  - "${c.term}" não bate com a análise dos tokens citados (${c.expected})`);
  console.log(`Resposta completa (@fim recebido): ${complete ? 'sim' : 'não'}`);
}

function printSummary(s: StructuredSummary, validCount: number): void {
  const all: Block[] = [...s.overview, ...SECTION_KEYS.flatMap((k) => s.sections[k] ?? [])];
  console.log('\n--- Visão geral ---');
  console.log(blocksToPlainText(s.overview));
  for (const key of SECTION_KEYS) {
    const blocks = s.sections[key];
    if (!blocks) {
      console.log(`\n--- ${SECTION_LABELS[key]} --- (não recebida)`);
      continue;
    }
    console.log(`\n--- ${SECTION_LABELS[key]} ---`);
    console.log(blocksToPlainText(blocks));
  }
  console.log('\n--- Perguntas para continuar ---');
  for (const q of s.questions) console.log(`- ${q}`);
  printValidation(all, validCount, s.complete);
}

function printAnswer(title: string, a: StructuredAnswer, validCount: number): void {
  console.log(`\n--- ${title} ---`);
  console.log(blocksToPlainText(a.blocks));
  if (a.followUps.length > 0) {
    console.log('\n--- Perguntas para continuar ---');
    for (const q of a.followUps) console.log(`- ${q}`);
  }
  printValidation(a.blocks, validCount, a.complete);
}

/** Lê as flags e os argumentos posicionais; `--section` consome o valor seguinte. */
function parseArgs(argv: string[]): { flags: Set<string>; section?: string; positional: string[] } {
  const flags = new Set<string>();
  const positional: string[] = [];
  let section: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--section') {
      section = argv[i + 1];
      i++;
    } else if (a.startsWith('--')) {
      flags.add(a);
    } else {
      positional.push(a);
    }
  }
  return { flags, section, positional };
}

async function streamTo(
  provider: OpenAICompatibleProvider,
  messages: ReturnType<typeof summaryMessages>,
  maxTokens: number,
): Promise<string> {
  let full = '';
  for await (const piece of provider.stream({ messages, temperature: 0.2, maxTokens })) {
    full += piece;
    process.stdout.write(piece);
  }
  process.stdout.write('\n');
  return full;
}

async function main(): Promise<void> {
  const { flags, section, positional } = parseArgs(process.argv.slice(2));

  if (flags.has('--list-models')) {
    const provider = new OpenAICompatibleProvider(providerFromEnv(process.env), fetch);
    const ids = await provider.listModels();
    console.log(ids.length > 0 ? ids.join('\n') : '(nenhum modelo retornado)');
    return;
  }

  const [refArg, ...questionParts] = positional;
  if (!refArg) {
    usage();
    process.exitCode = 1;
    return;
  }
  if (section !== undefined && !(SECTION_KEYS as readonly string[]).includes(section)) {
    console.error(`Seção desconhecida: "${section}".`);
    usage();
    process.exitCode = 1;
    return;
  }

  if (!existsSync(DB_PATH)) {
    console.error(`Banco não encontrado: ${DB_PATH}`);
    console.error('Gere-o com o pipeline (pipeline/build_db.py) antes de usar esta ferramenta.');
    process.exitCode = 1;
    return;
  }

  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const driver: SqlDriver = {
    async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as unknown as T[];
    },
  };
  const repo = new Repo(driver);

  try {
    const books = await repo.books();
    const range = parseRef(refArg, books);
    if (!range) {
      console.error(`Referência não reconhecida: "${refArg}". Exemplos: "Phil 2:5-8", "Filipenses 2", "Rom 8:28-30".`);
      process.exitCode = 1;
      return;
    }

    const panel = await buildPanel(repo, range, { textSource: 'blivre', contextVerses: 5, limits: DEFAULT_PANEL_LIMITS });
    printStats(panel);

    const context = serializePanel(panel, CONTEXT_BUDGET);
    console.log(
      `Contexto: ${context.text.length} caracteres de ${CONTEXT_BUDGET}, ${context.citeIds.size} cite_ids, ${context.omitted} registros omitidos.`,
    );
    if (flags.has('--context')) {
      console.log('\n' + context.text);
      return;
    }

    const cfg = providerFromEnv(process.env);
    if (!cfg.apiKey) {
      console.error('NVIDIA_API_KEY ausente no .env (raiz do repositório).');
      process.exitCode = 1;
      return;
    }
    if (!cfg.model) {
      console.error('NVIDIA_MODEL vazio no .env. Liste os modelos com: npm run ask -- --list-models');
      process.exitCode = 1;
      return;
    }

    const rich: RichTextContext = buildRichTextContext(context, panel, books);
    const provider = new OpenAICompatibleProvider(cfg, fetch);
    const question = questionParts.join(' ').trim();

    let answer: string;
    try {
      if (question) {
        console.log(`\n--- Resposta (${cfg.model}) ---\n`);
        answer = await streamTo(provider, answerMessages(context, [], question), CHAT_MAX_TOKENS);
        printAnswer('Resposta', parseStructuredAnswer(answer, rich), context.citeIds.size);
      } else if (section) {
        const key = section as SectionKey;
        console.log(`\n--- ${SECTION_LABELS[key]} (${cfg.model}) ---\n`);
        answer = await streamTo(provider, sectionMessages(context, key), SUMMARY_MAX_TOKENS);
        printAnswer(SECTION_LABELS[key], parseStructuredAnswer(answer, rich), context.citeIds.size);
      } else {
        console.log(`\n--- Resumo (${cfg.model}) ---\n`);
        answer = await streamTo(provider, summaryMessages(context), SUMMARY_MAX_TOKENS);
        printSummary(parseStructuredSummary(answer, rich), context.citeIds.size);
      }
    } catch (err) {
      console.error(`\n\nFalha na chamada ao provedor: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
      return;
    }
  } finally {
    db.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
