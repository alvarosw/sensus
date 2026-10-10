import { fetch as expoFetch } from 'expo/fetch';
import {
  createProvider,
  type ChatMessage,
  type FetchLike,
  type LLMProvider,
  type ProviderConfig,
} from '@sensus/core';

/**
 * fetch com streaming real (response.body) no React Native, via expo/fetch.
 * O fetch nativo do RN não entrega o corpo como stream.
 */
export const streamingFetch: FetchLike = (input, init) =>
  expoFetch(input, init as Parameters<typeof expoFetch>[1]) as unknown as Promise<Response>;

export function providerFor(config: ProviderConfig): LLMProvider & { listModels?: () => Promise<string[]> } {
  return createProvider(config, streamingFetch);
}

/**
 * Emite pedaços de texto (com marcadores [[cite_id]]) conforme chegam. Cancelável via signal.
 * maxTokens folgado: modelos com raciocínio gastam parte do limite antes de responder.
 */
export async function streamChat(
  config: ProviderConfig,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  maxTokens = 8000,
): Promise<void> {
  for await (const chunk of providerFor(config).stream({ messages, temperature: 0.2, maxTokens, signal })) {
    onChunk(chunk);
  }
}

/** Testa credenciais e conectividade listando os modelos (GET /models). Lança LLMError em falha. */
export async function listProviderModels(config: ProviderConfig): Promise<string[]> {
  const provider = providerFor(config);
  if (!provider.listModels) throw new Error('Provedor sem listagem de modelos.');
  return provider.listModels();
}
