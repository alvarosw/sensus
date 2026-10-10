import { fetch as expoFetch } from 'expo/fetch';
import {
  CHAT_CONTEXT_PREFIX,
  CHAT_MAX_TOKENS,
  createProvider,
  LLMError,
  SUMMARY_MAX_TOKENS,
  type ChatMessage,
  type FetchLike,
  type LLMProvider,
  type ProviderConfig,
} from '@sensus/core';
import { DEMO_PRESET_ID, DemoProvider } from './demo-provider';
import { getChatGPTAccessToken, markPlanNotEligible } from '@/auth/chatgpt/service';
import { useStudy } from '@/state/study';

/**
 * fetch com streaming real (response.body) no React Native, via expo/fetch.
 * O fetch nativo do RN não entrega o corpo como stream.
 */
export const streamingFetch: FetchLike = (input, init) =>
  expoFetch(input, init as Parameters<typeof expoFetch>[1]) as unknown as Promise<Response>;

export function providerFor(config: ProviderConfig): LLMProvider & { listModels?: () => Promise<string[]> } {
  // Preset 'demo': respostas gravadas, sem rede (ver ai/demo-provider.ts).
  if (config.id === DEMO_PRESET_ID) return new DemoProvider();
  // Plano ChatGPT: o token vem do armazenamento seguro e é renovado quando preciso.
  return createProvider(config, streamingFetch, { getAccessToken: getChatGPTAccessToken });
}

/** Pergunta sobre a passagem (chatMessages) carrega a mensagem de contexto; o resumo não. */
function isChatRequest(messages: readonly ChatMessage[]): boolean {
  return messages.some((m) => m.role === 'system' && m.content.startsWith(CHAT_CONTEXT_PREFIX));
}

/**
 * Emite pedaços de texto (com marcadores [[cite_id]]) conforme chegam. Cancelável via signal.
 * Limite de saída: SUMMARY_MAX_TOKENS para o resumo e CHAT_MAX_TOKENS para perguntas (detectadas
 * pelo contexto de chat); modelos com raciocínio gastam parte do limite antes de responder.
 * `onReasoning` avisa de cada pedaço de raciocínio (antes do texto) para a UI mostrar "pensando…".
 * Sem bytes por 45 s, lança LLMError com código 'timeout'.
 */
export async function streamChat(
  config: ProviderConfig,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  maxTokens = isChatRequest(messages) ? CHAT_MAX_TOKENS : SUMMARY_MAX_TOKENS,
  onReasoning?: () => void,
): Promise<void> {
  const run = async (cfg: ProviderConfig, emit: (chunk: string) => void): Promise<void> => {
    const stream = providerFor(cfg).stream({ messages, temperature: 0.2, maxTokens, signal, onReasoning });
    for await (const chunk of stream) emit(chunk);
  };
  let emitted = false;
  try {
    await run(config, (chunk) => {
      emitted = true;
      onChunk(chunk);
    });
  } catch (err) {
    if (!(err instanceof LLMError) || err.code !== 'plan_not_eligible' || emitted) throw err;
    // Conta recusada pelo plano (403), antes de qualquer texto: marca a conta e usa a chave de API.
    const firstRefusal = await markPlanNotEligible();
    if (!config.fallback) throw err;
    if (firstRefusal) {
      useStudy.getState().showToast({
        text: 'Sua conta do ChatGPT não tem o plano para o Sensus. Usando sua chave de API.',
      });
    }
    await run(config.fallback, onChunk);
  }
}

/** Testa credenciais e conectividade listando os modelos (GET /models). Lança LLMError em falha. */
export async function listProviderModels(config: ProviderConfig): Promise<string[]> {
  const provider = providerFor(config);
  if (!provider.listModels) throw new Error('Provedor sem listagem de modelos.');
  return provider.listModels();
}
