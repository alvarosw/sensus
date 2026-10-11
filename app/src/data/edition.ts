// Edição do banco: 'reader' (leitura: texto e parágrafos) ou 'full' (também comentários, léxico, etc.).
// O banco empacotado sem meta.edition é tratado como 'full' (bancos antigos e de desenvolvimento). Puro.
export type Edition = 'full' | 'reader';

/**
 * Esquema que o app sabe ler (meta.schema_version do banco). Acompanha SCHEMA_VERSION em pipeline/build_db.py:
 * subir os dois juntos quando o layout mudar.
 */
export const SUPPORTED_SCHEMA_VERSION = 3;

export function editionOf(meta: Readonly<Record<string, string>>): Edition {
  return meta.edition === 'reader' ? 'reader' : 'full';
}

export type FullCheck = 'ok' | 'corrupt' | 'schema' | 'edition';

/**
 * Um banco baixado só entra se declarar edition='full' e o esquema suportado.
 * 'corrupt' = sem meta legível; 'edition' = outra edição; 'schema' = esquema diferente.
 */
export function checkFullDatabase(meta: Readonly<Record<string, string>> | null): FullCheck {
  if (!meta || Object.keys(meta).length === 0) return 'corrupt';
  if (meta.edition !== 'full') return 'edition';
  if (Number(meta.schema_version) !== SUPPORTED_SCHEMA_VERSION) return 'schema';
  return 'ok';
}
