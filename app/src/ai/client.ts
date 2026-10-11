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
import { getChatGPTAccessToken, markChatGPTAttention, markChatGPTWorking } from '@/auth/chatgpt/service';
import { openChatGPTAttention } from '@/settings/attention';
import { usePrefs } from '@/settings/prefs';
import { decideError } from '@/settings/route';

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
 *
 * Reserva (regra em docs/AI_PROVIDERS.md, aplicada por decideError em settings/route.ts):
 *  - Config do ChatGPT com `fallback` (modo Automático): limite (plan_limit/rate_limit) pausa o ChatGPT e
 *    repete com a chave; falha transitória (5xx, rede, parada, protocolo) repete com a chave, sem pausa.
 *    Se já havia texto, `onRestart` avisa para descartar o parcial: a resposta é refeita inteira.
 *  - Falha de conta (reauth, not_eligible): nunca usa a chave; abre o aviso de atenção e lança o erro.
 *  - Sem `fallback` (Só ChatGPT, ou só chave): o erro é lançado como está.
 */
export async function streamChat(
  config: ProviderConfig,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  maxTokens = isChatRequest(messages) ? CHAT_MAX_TOKENS : SUMMARY_MAX_TOKENS,
  onReasoning?: () => void,
  onRestart?: () => void,
): Promise<void> {
  const run = async (cfg: ProviderConfig, emit: (chunk: string) => void): Promise<void> => {
    const stream = providerFor(cfg).stream({ messages, temperature: 0.2, maxTokens, signal, onReasoning });
    for await (const chunk of stream) emit(chunk);
  };
  try {
    await run(config, onChunk);
  } catch (err) {
    if (config.kind !== 'chatgpt' || signal?.aborted || !(err instanceof LLMError)) throw err;
    const { mode } = usePrefs.getState();
    const action = decideError(err, { mode, hasFallback: !!config.fallback, now: Date.now() });
    if (action.kind === 'attention') {
      await markChatGPTAttention(action.reason).catch(() => undefined);
      openChatGPTAttention(action.reason);
      throw err;
    }
    if (action.pause) usePrefs.getState().pauseChatGPT(action.pause);
    if (action.kind === 'error' || !config.fallback) throw err;
    // Refaz a resposta inteira com a chave: o texto parcial do ChatGPT é descartado, não emendado.
    onRestart?.();
    await run(config.fallback, onChunk);
    return;
  }
  if (config.kind === 'chatgpt') {
    // O plano respondeu: limpa a pausa e a atenção da conta.
    usePrefs.getState().clearPause();
    void markChatGPTWorking().catch(() => undefined);
  }
}

/** Testa credenciais e conectividade listando os modelos (GET /models). Lança LLMError em falha. */
export async function listProviderModels(config: ProviderConfig): Promise<string[]> {
  const provider = providerFor(config);
  if (!provider.listModels) throw new Error('Provedor sem listagem de modelos.');
  return provider.listModels();
}
