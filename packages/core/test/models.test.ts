import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  classifyModel,
  classifyModels,
  idExclusionReason,
  OpenAICompatibleProvider,
  orderModelListings,
  type FetchLike,
  type ProviderConfig,
} from '../src/index';

// Ids reais de GET https://integrate.api.nvidia.com/v1/models (sem metadados; ver o campo "source").
const nvidia = JSON.parse(readFileSync(new URL('./fixtures/nvidia-models.json', import.meta.url), 'utf8')) as {
  data: Array<{ id: string }>;
};

const usableIds = (entries: readonly unknown[]) =>
  classifyModels(entries).filter((m) => m.usable).map((m) => m.id);
const hiddenIds = (entries: readonly unknown[]) =>
  classifyModels(entries).filter((m) => !m.usable).map((m) => m.id);

describe('filtro por id (NVIDIA, lista real)', () => {
  const listing = classifyModels(nvidia.data);

  it('mantém 45 modelos de chat e oculta 35 da lista de 80', () => {
    expect(listing).toHaveLength(80);
    expect(listing.filter((m) => m.usable)).toHaveLength(45);
  });

  it('mantém os modelos de conversa, inclusive o recomendado', () => {
    const usable = usableIds(nvidia.data);
    for (const id of [
      'nvidia/nemotron-3-ultra-550b-a55b',
      'nvidia/nemotron-3-super-120b-a12b',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'meta/llama2-70b',
      'google/gemma-3-12b-it',
      'mistralai/mistral-large-2-instruct',
      'moonshotai/kimi-k3',
    ]) {
      expect(usable, id).toContain(id);
    }
  });

  it('oculta embeddings, rerankers, guardas, reward, parse, imagem/vídeo, tradução e código', () => {
    const hidden = hiddenIds(nvidia.data);
    for (const id of [
      'nvidia/embed-qa-4',
      'snowflake/arctic-embed-l',
      'nvidia/llama-3.2-nemoretriever-1b-vlm-embed-v1',
      'meta/llama-guard-4-12b',
      'nvidia/llama-3.1-nemoguard-8b-content-safety',
      'nvidia/nemotron-4-340b-reward',
      'nvidia/nemotron-parse',
      'google/diffusiongemma-26b-a4b-it',
      'nvidia/ai-synthetic-video-detector',
      'nvidia/riva-translate-4b-instruct',
      'bigcode/starcoder2-15b',
      'google/codegemma-7b',
      'meta/codellama-70b',
      'ibm/granite-8b-code-instruct',
      'nvidia/ising-calibration-1.5-31b',
    ]) {
      expect(hidden, id).toContain(id);
    }
  });
});

describe('idExclusionReason', () => {
  it('não exclui modelos de chat com nomes parecidos', () => {
    for (const id of ['google/gemma-3-4b-it', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', 'z-ai/glm-5.3-flash']) {
      expect(idExclusionReason(id), id).toBeNull();
    }
  });

  it('pega as variantes de OpenAI que não são chat', () => {
    for (const id of [
      'text-embedding-3-small', 'whisper-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-transcribe', 'dall-e-3',
      'gpt-image-1', 'omni-moderation-latest', 'davinci-002', 'babbage-002', 'gpt-4o-realtime-preview', 'sora-2',
    ]) {
      expect(idExclusionReason(id), id).not.toBeNull();
    }
  });
});

describe('metadados do provedor', () => {
  it('OpenRouter: saída sem texto é excluída, mesmo com id neutro', () => {
    const entry = {
      id: 'black-forest-labs/flux-pro',
      architecture: { input_modalities: ['text'], output_modalities: ['image'] },
    };
    expect(classifyModel(entry)).toEqual({ id: 'black-forest-labs/flux-pro', usable: false, reason: 'sem saída de texto' });
  });

  it('OpenRouter: saída de texto com imagem de entrada é de chat', () => {
    const entry = { id: 'openai/gpt-4o', architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] } };
    expect(classifyModel(entry)).toEqual({ id: 'openai/gpt-4o', usable: true });
  });

  it('o id vale mesmo com saída de texto: guarda de segurança continua oculta', () => {
    const entry = { id: 'meta-llama/llama-guard-4-12b', architecture: { output_modalities: ['text'] } };
    expect(classifyModel(entry)).toMatchObject({ usable: false, reason: 'segurança' });
  });

  it('campo type declarado por alguns provedores', () => {
    expect(classifyModel({ id: 'acme/bge-large', type: 'embedding' })).toMatchObject({ usable: false });
    expect(classifyModel({ id: 'acme/llama', type: 'chat' })).toEqual({ id: 'acme/llama', usable: true });
  });

  it('lista da OpenAI (só ids): ocultos e de chat', () => {
    const data = [
      'gpt-4o-mini', 'gpt-4o', 'o3-mini', 'gpt-4o-audio-preview', 'text-embedding-3-large', 'whisper-1',
      'tts-1', 'dall-e-2', 'omni-moderation-latest', 'davinci-002', 'gpt-4o-realtime-preview', 'gpt-image-1',
    ].map((id) => ({ id, object: 'model', created: 1, owned_by: 'openai' }));
    expect(usableIds(data)).toEqual(['gpt-4o', 'gpt-4o-audio-preview', 'gpt-4o-mini', 'o3-mini']);
  });

  it('entradas sem id são descartadas e ids repetidos aparecem uma vez', () => {
    const data = [{ id: 'a-chat' }, {}, { id: '' }, null, { id: 'a-chat' }, 'texto'];
    expect(classifyModels(data)).toEqual([{ id: 'a-chat', usable: true }]);
  });
});

describe('orderModelListings', () => {
  it('mostra os utilizáveis primeiro, com o recomendado no topo', () => {
    const listings = [
      { id: 'a-embed', usable: false, reason: 'embeddings' },
      { id: 'c-chat', usable: true },
      { id: 'nvidia/nemotron-3-ultra-550b-a55b', usable: true },
      { id: 'b-chat', usable: true },
    ];
    expect(orderModelListings(listings, 'nvidia/nemotron-3-ultra-550b-a55b').map((m) => m.id)).toEqual([
      'nvidia/nemotron-3-ultra-550b-a55b',
      'b-chat',
      'c-chat',
      'a-embed',
    ]);
  });
});

describe('OpenAICompatibleProvider: listagem e verificação', () => {
  const config: ProviderConfig = {
    id: 'openrouter',
    kind: 'openai-compatible',
    label: 'OpenRouter (teste)',
    baseUrl: 'https://provider.test/v1',
    apiKey: 'segredo',
    model: 'acme/chat',
  };

  it('listModelListings aplica o filtro sobre GET /models', async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: 'acme/chat', architecture: { output_modalities: ['text'] } },
            { id: 'acme/image', architecture: { output_modalities: ['image'] } },
            { id: 'acme/embed-small' },
          ],
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    const listing = await new OpenAICompatibleProvider(config, fetchImpl).listModelListings();
    expect(listing.map((m) => [m.id, m.usable])).toEqual([
      ['acme/chat', true],
      ['acme/embed-small', false],
      ['acme/image', false],
    ]);
  });

  it('checkModel envia um chat de 1 token sem streaming e aceita qualquer sucesso', async () => {
    let url = '';
    let body: Record<string, unknown> = {};
    const fetchImpl: FetchLike = async (u, init) => {
      url = u;
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }), {
        headers: { 'content-type': 'application/json' },
      });
    };
    await new OpenAICompatibleProvider(config, fetchImpl).checkModel();
    expect(url).toBe('https://provider.test/v1/chat/completions');
    expect(body).toMatchObject({ model: 'acme/chat', max_tokens: 1, stream: false });
  });

  it('checkModel converte 404 do provedor em LLMError not_found com o detalhe', async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(JSON.stringify({ error: 'Function not found for account' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    await expect(new OpenAICompatibleProvider(config, fetchImpl).checkModel()).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
      message: expect.stringContaining('Function not found for account'),
    });
  });
});
