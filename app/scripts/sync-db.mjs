// Copia o banco gerado pelo pipeline (data/sensus.db) para o bundle do app.
// Também grava src/data/bundled-db.json com o meta.built_at do banco copiado,
// que o app compara com o banco já instalado para decidir se reimporta.
//
// Uso: npm run sync-db   (a partir de app/)
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(appDir, '..', 'data', 'sensus.db');
const target = resolve(appDir, 'assets', 'sensus.db');
const meta = resolve(appDir, 'src', 'data', 'bundled-db.json');

if (!existsSync(source)) {
  console.error(`Banco não encontrado: ${source}`);
  console.error('Gere-o com: cd pipeline && python3 build_db.py');
  process.exit(1);
}

const db = new DatabaseSync(source, { readOnly: true });
const row = db.prepare("SELECT value FROM meta WHERE key = 'built_at'").get();
db.close();
if (!row) {
  console.error('meta.built_at ausente em', source);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
mkdirSync(dirname(meta), { recursive: true });
copyFileSync(source, target);
writeFileSync(meta, JSON.stringify({ builtAt: row.value }, null, 2) + '\n');
console.log(`sensus.db copiado (built_at=${row.value}) -> ${target}`);
