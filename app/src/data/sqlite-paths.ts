// Pasta do SQLite do app: a mesma que o expo-sqlite usa por padrão (<documentos>/SQLite). Fica em arquivo próprio
// para o banco principal (active-db.ts) e as Bíblias baixadas (bibles/bible-db.ts) não dependerem um do outro.
import { Directory, Paths } from 'expo-file-system';

export function sqliteDirectory(): Directory {
  return new Directory(Paths.document, 'SQLite');
}
