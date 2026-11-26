// Regras puras da curiosidade do trecho na folha (sem React e sem banco): o que o gerador devolveu vira candidata ou
// some; e o texto que a tela mostra (sem os marcadores [[cite_id]]). O fluxo (chamadas à IA) está em useCuriosity.ts.
import { acceptCuriosity, parseCuriosity, type CuriosityCandidate, type RichTextContext } from '@sensus/core';

/** Passo do gerador: ou some (com o motivo) ou vira candidata para o revisor. */
export type GeneratorStep = { kind: 'hide'; reason: string } | { kind: 'candidate'; candidate: CuriosityCandidate };

/** Filtros 1 e 2: a resposta do modelo ("@nenhuma", malformada ou reprovada no portão) ou a candidata aprovada. */
export function judgeGenerator(raw: string, ctx: RichTextContext): GeneratorStep {
  const parsed = parseCuriosity(raw);
  if (parsed === 'none') return { kind: 'hide', reason: '@nenhuma: nenhuma curiosidade no trecho' };
  if (parsed === null) return { kind: 'hide', reason: 'resposta malformada ou incompleta' };
  const gate = acceptCuriosity(parsed, ctx);
  if (!gate.ok) return { kind: 'hide', reason: `reprovada no portão: ${gate.reason}` };
  return { kind: 'candidate', candidate: parsed };
}

/** Texto de um campo sem os marcadores [[cite_id]] e com espaços normalizados (gancho e o que muda, no anexo). */
export function plainText(s: string): string {
  return s.replace(/\[\[[^\]\n]*\]\]/g, '').replace(/\s+/g, ' ').replace(/ ([.,;:!?])/g, '$1').trim();
}

/** Rótulo curto do anexo no chat (mesmo corte das afirmações: 34 caracteres). */
export function shortHook(hook: string): string {
  return hook.length > 34 ? `${hook.slice(0, 34).trim()}…` : hook;
}
