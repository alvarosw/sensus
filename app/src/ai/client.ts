import { fetch as expoFetch } from 'expo/fetch';
import {
  CHAT_CONTEXT_PREFIX,
  CHAT_MAX_TOKENS,
  createProvider,
  SUMMARY_MAX_TOKENS,
  type ChatMessage,
  type FetchLike,
  type LLMProvider,
  type ProviderConfig,
} from '@sensus/core';
import { DEMO_PRESET_ID, DemoProvider } from './demo-provider';

/**
 * fetch com streaming real (response.body) no React Native, via expo/fetch.
 * O fetch nativo do RN não entrega o corpo como stream.
 */
export const streamingFetch: FetchLike = (input, init) =>
  expoFetch(input, init as Parameters<typeof expoFetch>[1]) as unknown as Promise<Response>;

export function providerFor(config: ProviderConfig): LLMProvider & { listModels?: () => Promise<string[]> } {
  // Preset 'demo': respostas gravadas, sem rede (ver ai/demo-provider.ts).
  if (config.id === DEMO_PRESET_ID) return new DemoProvider();
  return createProvider(config, streamingFetch);
}

/** Pergunta sobre a passagem (chatMessages) carrega a mensagem de contexto; o resumo não. */
function isChatRequest(messages: readonly ChatMessage[]): boolean {
  return messages.some((m) => m.role === 'system' && m.content.startsWith(CHAT_CONTEXT_PREFIX));
}

/**
 * Emite pedaços de texto (com marcadores [[cite_id]]) conforme chegam. Cancelável via signal.
 * Limite de saída: SUMMARY_MAX_TOKENS para o resumo e CHAT_MAX_TOKENS para perguntas (detectadas
 * pelo contexto de chat); modelos com raciocínio gastam parte do limite antes de responder.
 */
export async function streamChat(
  config: ProviderConfig,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  maxTokens = isChatRequest(messages) ? CHAT_MAX_TOKENS : SUMMARY_MAX_TOKENS,
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
