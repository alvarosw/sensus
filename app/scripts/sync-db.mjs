// Copia o banco gerado pelo pipeline (data/sensus.db) para o bundle do app.
// Também grava src/data/bundled-db.json com o meta.built_at do banco copiado,
// que o app compara com o banco já instalado para decidir se reimporta.
//
// Uso: npm run sync-db [caminho/do/banco.db]   (a partir de app/)
// Sem caminho usa ../data/sensus.db. Para o banco de leitura (edition='reader'), passe o caminho dele: é o que
// o APK empacota; o banco completo é baixado depois (ver src/data/download-engine.ts).
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(appDir, '..', 'data', 'sensus.db');
const target = resolve(appDir, 'assets', 'sensus.db');
const meta = resolve(appDir, 'src', 'data', 'bundled-db.json');

if (!existsSync(source)) {
  console.error(`Banco não encontrado: ${source}`);
  console.error('Gere-o com: cd pipeline && python3 build_db.py');
  process.exit(1);
}

const db = new DatabaseSync(source, { readOnly: true });
const row = db.prepare("SELECT value FROM meta WHERE key = 'built_at'").get();
const edition = db.prepare("SELECT value FROM meta WHERE key = 'edition'").get()?.value ?? 'full (sem meta.edition)';
db.close();
if (!row) {
  console.error('meta.built_at ausente em', source);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
mkdirSync(dirname(meta), { recursive: true });
copyFileSync(source, target);
writeFileSync(meta, JSON.stringify({ builtAt: row.value }, null, 2) + '\n');
console.log(`sensus.db copiado (edição=${edition}, built_at=${row.value}) -> ${target}`);
