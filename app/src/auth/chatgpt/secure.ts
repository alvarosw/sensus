// Valores longos no expo-secure-store: alguns iOS recusam itens acima de ~2 KB, então o valor é
// dividido em partes. A chave base guarda {"n": partes}; as partes ficam em "<chave>.<i>".
// A meta é escrita por último, então um leitor nunca vê partes faltando sem perceber.
import * as SecureStore from 'expo-secure-store';

const PART_CHARS = 600;

function parts(value: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < value.length; i += PART_CHARS) out.push(value.slice(i, i + PART_CHARS));
  return out.length > 0 ? out : [''];
}

async function readMetaCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return 0;
  try {
    const n = (JSON.parse(raw) as { n?: unknown }).n;
    return typeof n === 'number' && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function writeSecret(key: string, value: string): Promise<void> {
  const pieces = parts(value);
  const previous = await readMetaCount(key);
  for (let i = 0; i < pieces.length; i++) {
    await SecureStore.setItemAsync(`${key}.${i}`, pieces[i]!);
  }
  await SecureStore.setItemAsync(key, JSON.stringify({ n: pieces.length }));
  for (let i = pieces.length; i < previous; i++) {
    await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
}

export async function readSecret(key: string): Promise<string | null> {
  const n = await readMetaCount(key);
  if (n === 0) return null;
  let out = '';
  for (let i = 0; i < n; i++) {
    const piece = await SecureStore.getItemAsync(`${key}.${i}`);
    if (piece === null) return null;
    out += piece;
  }
  return out;
}

export async function deleteSecret(key: string): Promise<void> {
  const n = await readMetaCount(key);
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  await SecureStore.deleteItemAsync(key);
}
