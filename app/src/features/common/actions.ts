// Ações compartilhadas por prévia, painéis e chat sobre o estado de estudo.
import type { Vid } from '@sensus/core';
import { useStudy, type Attachment } from '@/state/study';
import type { CiteDetail } from './cites';

/** Fecha camadas (prévia, painéis, chat) e leva o leitor ao versículo, mantendo a seleção. */
export function showInText(vid: Vid): void {
  const s = useStudy.getState();
  s.closePopover();
  s.closePanels();
  s.closeChat();
  if (s.detent === 'full') s.setDetent('half');
  s.jumpTo(vid);
}

const KIND_OF: Record<CiteDetail['kind'], Attachment['kind']> = {
  txt: 'verse',
  tok: 'token',
  lex: 'cite',
  com: 'cite',
  dic: 'cite',
  xr: 'xref',
  ent: 'cite',
};

/** Anexo para a pergunta a partir de um registro citável. */
export function attachmentOf(d: CiteDetail): Attachment {
  return {
    id: d.citeId,
    kind: KIND_OF[d.kind],
    label: d.label,
    citeIds: [d.citeId],
  };
}

/** Anexa o registro ao próximo envio e abre o chat (prévia/painéis ficam por cima ou fecham, conforme o chamador). */
export function askAbout(d: CiteDetail, opts: { closePanels?: boolean } = {}): void {
  const s = useStudy.getState();
  s.attach(attachmentOf(d));
  s.closePopover();
  if (opts.closePanels) s.closePanels();
  s.openChat();
}

/** Qual painel empilhado abre o "Abrir completo" de cada tipo. */
export function panelFor(d: CiteDetail): Parameters<ReturnType<typeof useStudy.getState>['pushPanel']>[0] {
  if (d.kind === 'tok') return { kind: 'word', tokenCiteId: d.citeId };
  if (d.kind === 'ent') return { kind: 'entity', citeId: d.citeId };
  return { kind: 'source', citeId: d.citeId };
}
