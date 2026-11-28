import { localized } from '../../i18n';
import { shareTables } from '../../i18n/locales/all';
// Textos (pt-BR) da barra de seleção, da prévia de copiar e compartilhar e da síntese em texto simples.

const ptShare = {
  /** Rótulo de acessibilidade da barra de ações da seleção. */
  barLabel: 'Ações da seleção',
  study: 'Estudar',
  copy: 'Copiar',
  share: 'Compartilhar',
  /** Botão que abre a folha do sistema. */
  shareMore: 'Compartilhar…',
  copyTitle: 'Copiar trecho',
  shareTitle: 'Compartilhar trecho',
  synthTitle: 'Compartilhar síntese',
  /** Link na Visão geral da folha de estudo. */
  shareSynth: 'Compartilhar síntese',
  close: 'Fechar',
  verseNumbers: 'Números dos versículos',
  plainText: 'Texto simples',
  previewLabel: 'Texto que vai sair',
  /** `shown` = o número já formatado no idioma do app. */
  chars: (n: number, shown: string) => `${shown} ${n === 1 ? 'caractere' : 'caracteres'}`,
  loading: 'Carregando o texto…',
  loadError: 'Não foi possível carregar o texto.',
  copied: (what: string) => `Copiado · ${what}`,
  synthOf: (ref: string) => `síntese de ${ref}`,
  copyFailed: 'Não foi possível copiar.',
  shareFailed: 'Não foi possível abrir o compartilhamento.',
  // síntese em texto simples
  sources: 'Fontes',
  inference: '(Inferência)',
  aiFooter: 'Resumo gerado por IA a partir das fontes acima.',
  via: 'via Sensus',
};

export type ShareStrings = typeof ptShare;
export const SHARE = localized<ShareStrings>({ pt: ptShare, ...shareTables });
