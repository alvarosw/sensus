// Lentes da folha de estudo, uma por arquivo. A folha escolhe a lente pela chave (LENS_VIEWS).
import type { ReactNode } from 'react';
import type { LensKey } from '@/state/study';
import { VisaoLens } from './Visao';
import { TextoLens } from './Texto';
import { LiterarioLens } from './Literario';
import { HistoricoLens } from './Historico';
import { LinguaLens } from './Lingua';
import { IntertextoLens } from './Intertexto';
import { InterpretacaoLens } from './Interpretacao';
import { AplicacaoLens } from './Aplicacao';
import type { LensProps } from './shared';

export type { LensProps } from './shared';

export const LENS_VIEWS: Record<LensKey, (p: LensProps) => ReactNode> = {
  visao: VisaoLens,
  texto: TextoLens,
  literario: LiterarioLens,
  historico: HistoricoLens,
  lingua: LinguaLens,
  intertexto: IntertextoLens,
  interpretacao: InterpretacaoLens,
  aplicacao: AplicacaoLens,
};
