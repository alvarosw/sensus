// Porta de criptografia do núcleo (SHA-256 e bytes aleatórios) com expo-crypto.
import * as Crypto from 'expo-crypto';
import type { CryptoPort } from '@sensus/core';

export const expoCrypto: CryptoPort = {
  async sha256(data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(data)));
  },
  randomBytes(length: number): Uint8Array {
    return Crypto.getRandomBytes(length);
  },
};
