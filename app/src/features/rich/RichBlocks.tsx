// Esqueleto — implementado pelo agente da folha de estudo; usado também pelo chat.
import type { ReactElement } from 'react';
// Renderiza Block[] (parseRichText/parseStructured*) com o design system: citações, grego, estados de confiabilidade.
import type { Block } from '@sensus/core';

export interface RichBlocksProps {
  blocks: Block[];
  /** Mostra o cursor piscante no fim (texto em streaming). */
  streaming?: boolean;
  /** Prefixo das chaves de afirmação (ex.: "texto", "ans-<turnId>") — usado em anexos e testIDs. */
  claimKeyPrefix: string;
  onCite: (citeId: string) => void;
  onToken: (tokenCiteId: string) => void;
  /** Menu ⋯ do parágrafo (Detalhar / De onde vem isso? / Perguntar sobre isto). */
  onClaimMore?: (claimKey: string, block: Block) => void;
}

export function RichBlocks(_props: RichBlocksProps): ReactElement | null {
  return null;
}
