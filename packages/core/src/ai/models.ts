// Filtro do seletor de modelos: só modelos que conversam em texto (chat). Usa metadados quando o
// provedor os envia (OpenRouter: architecture.output_modalities; genérico: type) e, sem eles, o id.
// Metadados só excluem; o id vale sempre (ex.: llama-guard tem saída de texto e mesmo assim não conversa).
// Provedores só com ids (NVIDIA, OpenAI) dependem da heurística. Ver docs/AI_PROVIDERS.md.

export interface ModelListing {
  id: string;
  /** Adequado a conversa em texto. Falso: fica oculto no seletor ("Mostrar todos" revela). */
  usable: boolean;
  /** Motivo curto da ocultação (pt-BR), quando usable é falso. */
  reason?: string;
}

/** Regras sobre o id (minúsculo). Ordem importa só para o motivo mostrado; a primeira que casar vale. */
const ID_EXCLUSIONS: ReadonlyArray<{ re: RegExp; reason: string }> = [
  { re: /embed/, reason: 'embeddings' },
  { re: /rerank|retriev/, reason: 'reranqueador' },
  { re: /guard|safety|moderation/, reason: 'segurança' },
  { re: /reward/, reason: 'avaliação de respostas' },
  { re: /parse|\bocr/, reason: 'extração de documentos' },
  { re: /kosmos|fuyu|\bneva\b|\bn?vila\b|deplot|clip|cosmos/, reason: 'visão (sem chat)' },
  { re: /image|dall-?e|diffusion/, reason: 'imagem' },
  { re: /video|\bsora\b/, reason: 'vídeo' },
  { re: /whisper|\btts\b|\basr\b|transcri/, reason: 'áudio' },
  { re: /translat/, reason: 'tradução' },
  { re: /detector|calibration/, reason: 'análise, não chat' },
  { re: /\bcode\b|coder|codex|codegemma|codellama|codestral|starcoder/, reason: 'só código' },
  { re: /realtime/, reason: 'tempo real' },
  { re: /davinci|babbage/, reason: 'completions legado' },
];

/** Tipos declarados por alguns provedores (ex.: Together, LM Studio) que não conversam em texto. */
const NON_TEXT_TYPES = new Set([
  'embedding', 'embeddings', 'rerank', 'reranker', 'image', 'moderation', 'audio', 'video', 'tts', 'stt',
  'transcription', 'code', 'reward',
]);

interface RawModelEntry {
  id?: unknown;
  type?: unknown;
  architecture?: { output_modalities?: unknown } | null;
}

/** Motivo de exclusão pelos metadados do provedor, ou null quando eles não excluem (ou não existem). */
function metadataExclusion(entry: RawModelEntry): string | null {
  const outputs = entry.architecture?.output_modalities;
  if (Array.isArray(outputs) && outputs.length > 0 && !outputs.includes('text')) return 'sem saída de texto';
  if (typeof entry.type === 'string' && NON_TEXT_TYPES.has(entry.type.toLowerCase())) return `tipo ${entry.type}`;
  return null;
}

/** Motivo de exclusão pelo id, ou null. */
export function idExclusionReason(id: string): string | null {
  const lower = id.toLowerCase();
  for (const rule of ID_EXCLUSIONS) if (rule.re.test(lower)) return rule.reason;
  return null;
}

/** Classifica uma entrada de GET /models. Entradas sem id válido devolvem null. */
export function classifyModel(entry: unknown): ModelListing | null {
  if (!entry || typeof entry !== 'object') return null;
  const raw = entry as RawModelEntry;
  if (typeof raw.id !== 'string' || raw.id.trim() === '') return null;
  const id = raw.id.trim();
  const reason = metadataExclusion(raw) ?? idExclusionReason(id);
  return reason ? { id, usable: false, reason } : { id, usable: true };
}

/** Classifica a lista `data` de GET /models: sem duplicatas, ordenada por id. */
export function classifyModels(entries: readonly unknown[]): ModelListing[] {
  const seen = new Map<string, ModelListing>();
  for (const entry of entries) {
    const listing = classifyModel(entry);
    if (listing && !seen.has(listing.id)) seen.set(listing.id, listing);
  }
  return [...seen.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Ordem do seletor: utilizáveis primeiro, com o modelo recomendado (preset) no topo; ocultos depois.
 * Dentro de cada grupo, ordem alfabética por id.
 */
export function orderModelListings(listings: readonly ModelListing[], preferredId?: string): ModelListing[] {
  const rank = (m: ModelListing) => (m.usable ? 0 : 2) + (m.id === preferredId ? -1 : 0);
  return [...listings].sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
