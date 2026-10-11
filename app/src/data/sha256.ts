// SHA-256 incremental (por blocos), para conferir o ZIP sem carregá-lo inteiro na memória.
// expo-crypto só tem digest de uma vez (o arquivo inteiro na memória), por isso usamos @noble/hashes.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export interface Sha256Stream {
  update(chunk: Uint8Array): void;
  /** Hex minúsculo do digest. Uma vez só. */
  hexDigest(): string;
}

export function createSha256Stream(): Sha256Stream {
  const h = sha256.create();
  return {
    update: (chunk) => {
      h.update(chunk);
    },
    hexDigest: () => bytesToHex(h.digest()),
  };
}

export function sameDigest(actualHex: string, expectedHex: string): boolean {
  return actualHex.toLowerCase() === expectedHex.toLowerCase();
}
