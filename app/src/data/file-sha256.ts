// sha256 de um arquivo, lido em blocos (o ZIP não entra inteiro na memória). A conta é de sha256.ts; aqui fica só
// a leitura do arquivo. Usado pelo download do banco completo (download-engine.ts) e pelas Bíblias baixadas.
import { File, FileMode } from 'expo-file-system';
import { createSha256Stream } from './sha256';

const HASH_BLOCK = 1024 * 1024;

/** Hex minúsculo do sha256 do arquivo. Cede a thread entre os blocos (a UI segue responsiva). */
export async function sha256OfFile(file: File): Promise<string> {
  const h = file.open(FileMode.ReadOnly);
  try {
    h.offset = 0;
    const stream = createSha256Stream();
    for (;;) {
      const block = h.readBytes(HASH_BLOCK);
      if (block.byteLength === 0) break;
      stream.update(block);
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    return stream.hexDigest();
  } finally {
    h.close();
  }
}
