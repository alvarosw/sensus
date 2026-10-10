// CLI de teste ponta a ponta, sem celular.
//   npm run ask -- "Phil 2:5-8"                  resumo estruturado da passagem
//   npm run ask -- "Phil 2:5-8" "sua pergunta"   resposta com base no contexto
//   npm run ask -- "Phil 2:5-8" --context        só imprime o contexto serializado
//   npm run ask -- --list-models                 lista os modelos do provedor (NVIDIA_*)
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { config as loadEnv } from 'dotenv';
import {
  buildPanel,
  buildProviderConfig,
  chatMessages,
  DEFAULT_PANEL_LIMITS,
  OpenAICompatibleProvider,
  parseCited,
  parseRef,
  Repo,
  serializePanel,
  summaryMessages,
  type CitedSegment,
  type PanelData,
  type SqlDriver,
  type SqlParam,
} from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/core/tools -> raiz do repositório
const ROOT = resolve(HERE, '..', '..', '..');
loadEnv({ path: resolve(ROOT, '.env') });

const CONTEXT_BUDGET = 60_000;
/** data/sensus.db na raiz; SENSUS_DB aponta para outro arquivo (ex.: um banco de teste). */
const DB_PATH = process.env.SENSUS_DB ? resolve(process.env.SENSUS_DB) : resolve(ROOT, 'data', 'sensus.db');

function usage(): void {
  console.error('Uso: npm run ask -- "<referência>" [pergunta] [--context]');
  console.error('     npm run ask -- --list-models');
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

function printReport(segments: CitedSegment[], validIds: ReadonlySet<string>): void {
  const body = segments;
  const validCount = body.reduce((n, s) => n + s.cites.length, 0);
  const invalid = body.flatMap((s) => s.invalidCites);
  const distinct = new Set(body.flatMap((s) => s.cites));
  const uncited = body.filter((s) => s.kind === 'uncited');
  const sourced = body.filter((s) => s.kind === 'source').length;
  const inference = body.filter((s) => s.kind === 'inference').length;
  const structure = body.filter((s) => s.kind === 'structure').length;

  console.log('\n--- Validação de citações ---');
  console.log(
    `Trechos: ${body.length} (${sourced} com fonte, ${inference} inferências, ${structure} estrutura, ${uncited.length} sem citação)`,
  );
  console.log(`Citações: ${validCount} válidas (${distinct.size} distintas, de ${validIds.size} disponíveis), ${invalid.length} inválidas`);
  if (invalid.length > 0) {
    console.log('Inválidas:');
    for (const id of [...new Set(invalid)]) console.log(`  - ${id}`);
  }
  if (uncited.length > 0) {
    console.log('Trechos sem citação (revisar se são fatos):');
    for (const s of uncited.slice(0, 8)) console.log(`  - ${s.text.slice(0, 140)}`);
    if (uncited.length > 8) console.log(`  ... e mais ${uncited.length - 8}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const positional = args.filter((a) => !a.startsWith('--'));

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
    const range = parseRef(refArg, await repo.books());
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

    const question = questionParts.join(' ').trim();
    const messages = question ? chatMessages(context, [], question) : summaryMessages(context);
    const provider = new OpenAICompatibleProvider(cfg, fetch);

    console.log(`\n--- ${question ? 'Resposta' : 'Resumo'} (${cfg.model}) ---\n`);
    let answer = '';
    try {
      for await (const piece of provider.stream({
        messages,
        temperature: 0.2,
        maxTokens: question ? 4000 : 8000,
      })) {
        answer += piece;
        process.stdout.write(piece);
      }
    } catch (err) {
      console.error(`\n\nFalha na chamada ao provedor: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write('\n');

    printReport(parseCited(answer, context.citeIds), context.citeIds);
  } finally {
    db.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
