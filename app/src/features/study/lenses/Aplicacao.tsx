// Lente Aplicação: ainda sem conteúdo; mostra só o cabeçalho da seção.
import { STUDY } from '../strings';
import { LensShell } from '../LensShell';
import { SECTION_LABEL, type LensProps } from './shared';

export function AplicacaoLens({ onLayout }: LensProps) {
  return <LensShell lens="aplicacao" title={SECTION_LABEL.aplicacao} count={STUDY.lensCount.aplicacao} onLayout={onLayout} />;
}
