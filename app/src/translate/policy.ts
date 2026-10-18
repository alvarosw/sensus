// Regras puras da tradução automática (sem React, sem RN): quando traduzir, quem mostra a oferta, quais textos
// entram num lote e em que fase está o lote. O hook useTranslatable só junta estado e efeitos a estas decisões.

/**
 * item: um bloco de texto (painel, estudo). Oferta uma vez por sessão e "Ver original" deste bloco; lote imediato.
 * global: a tela inteira (linha do tempo). Sem oferta, um "Ver original" para tudo, lote por quadro entre telas.
 */
export type TranslatePolicy = 'item' | 'global';

/** Textos de um pedido: sem os vazios ou só de espaços, na ordem em que vieram. */
export function batchTexts(texts: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const t of texts) if (t && t.trim().length > 0) out.push(t);
  return out;
}

/** Chave do lote (muda só quando o conteúdo muda, não a identidade do array). */
export const BATCH_SEP = '\u0001';

export function batchKey(texts: readonly string[]): string {
  return texts.join(BATCH_SEP);
}

export function batchFromKey(key: string): string[] {
  return key ? key.split(BATCH_SEP) : [];
}

/** Há o que traduzir nesta tela: aparelho compatível e pelo menos um texto (a fonte já foi checada). */
export function isEligible(input: { supported: boolean; translatable: boolean; texts: number }): boolean {
  return input.supported && input.translatable && input.texts > 0;
}

/** A tradução está configurada e pronta para pedir: ligada, preferências carregadas e (no global) modelo pronto. */
export function isActive(
  policy: TranslatePolicy,
  input: { supported: boolean; loaded: boolean; enabled: boolean; model: string; translatable: boolean },
): boolean {
  const base = input.supported && input.loaded && input.enabled && input.translatable;
  return policy === 'global' ? base && input.model === 'ready' : base;
}

/**
 * A oferta da primeira vez aparece? Só no policy item, enquanto a opção está desligada e a oferta não foi respondida.
 * `owner` é o painel que já a reivindicou nesta sessão (null: ninguém ainda); só ele (ou o primeiro) a mostra.
 */
export function isOfferShown(
  policy: TranslatePolicy,
  input: {
    eligible: boolean;
    loaded: boolean;
    enabled: boolean;
    offerAnswered: boolean;
    owner: number | null;
    panelId: number;
  },
): boolean {
  if (policy !== 'item') return false;
  const base = input.eligible && input.loaded && !input.enabled && !input.offerAnswered;
  return base && (input.owner === null || input.owner === input.panelId);
}

/** Resultado do último lote deste bloco: ainda não chegou, chegou, ou falhou. */
export type BatchResult = 'pending' | 'ok' | 'error';

/**
 * Fase do lote para a nota: carregando quando há trechos sem tradução e o lote ainda não voltou; falha quando voltou
 * com erro. Com tudo traduzido, nenhuma das duas.
 */
export function batchPhase(input: { active: boolean; allCached: boolean; result: BatchResult }): {
  loading: boolean;
  failed: boolean;
} {
  const missing = input.active && !input.allCached;
  return {
    loading: missing && input.result === 'pending',
    failed: missing && input.result === 'error',
  };
}

/**
 * Textos que o lote global ainda precisa pedir: sem tradução no cache e fora da lista de falhas desta sessão.
 */
export function globalAskList(
  texts: readonly string[],
  has: { cached(text: string): boolean; failed(text: string): boolean },
): string[] {
  return texts.filter((t) => t.trim().length > 0 && !has.failed(t) && !has.cached(t));
}

/**
 * Nomes e títulos da linha do tempo: mostrar o texto em português da fonte (sem passar pela tradução)? Sim, salvo
 * quando a tradução está ativa e o usuário pediu "Ver original". Se a tradução ficou inativa (desligada ou modelo
 * removido), o pt continua valendo, senão o nome ficaria preso em inglês sem o botão para voltar.
 */
export function preferPt(active: boolean, showOriginal: boolean): boolean {
  return !(active && showOriginal);
}

/**
 * Contagens de uma tela para a nota da linha do tempo. `pt`: textos que mostram o pt da fonte (ver shownEntityName).
 * `cached`: textos sem pt que já têm tradução no cache, ou seja, os que a tela mostraria traduzidos.
 */
export interface NoteCounts {
  pt: number;
  cached: number;
}

/**
 * Conta os textos de uma tela. `pt` marca o texto com versão pt do banco (não passa pela tradução). Os demais contam
 * como `cached` quando `cached(text)` diz que a tradução já está no cache. Não depende de "Ver original": a nota
 * precisa saber o que mudaria ao alternar.
 */
export function noteCounts(items: readonly { text: string; pt: boolean }[], cached: (text: string) => boolean): NoteCounts {
  let pt = 0;
  let translated = 0;
  for (const item of items) {
    if (item.pt) pt++;
    else if (item.text.trim().length > 0 && cached(item.text)) translated++;
  }
  return { pt, cached: translated };
}

/**
 * O que a nota da linha do tempo diz numa tela:
 *  - none: nada a dizer (tradução inativa, ou nenhum texto pt nem traduzido);
 *  - machine: algum texto da tela foi traduzido pelo modelo, nenhum tem pt ("Títulos traduzidos automaticamente");
 *  - partial: traduzidos pelo modelo e também com pt ("Alguns textos traduzidos automaticamente");
 *  - pt: só texto pt do banco, sem tradução (só o "Ver original" discreto, sem aviso de tradução);
 *  - original: "Ver original" ligado, com algo a voltar (pt ou tradução); o botão volta à tradução.
 */
export type TimelineNoteKind = 'none' | 'machine' | 'partial' | 'pt' | 'original';

export function timelineNoteKind(input: NoteCounts & { active: boolean; showOriginal: boolean }): TimelineNoteKind {
  if (!input.active) return 'none';
  if (input.showOriginal) return input.pt + input.cached > 0 ? 'original' : 'none';
  if (input.cached > 0) return input.pt > 0 ? 'partial' : 'machine';
  return input.pt > 0 ? 'pt' : 'none';
}
