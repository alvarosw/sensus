// Textos das Bíblias baixadas (pt-BR): lista de Bíblias (Configurações > Bíblias e o passo de Bíblia da
// apresentação), Aparência e o seletor do leitor.
import type { DataError } from '../download-machine';
import { localized } from '../../i18n';
import { biblesTables } from '../../i18n/locales/all';

const ptBibles = {
  title: 'Bíblias',
  rowTitle: 'Bíblias',
  rowSubtitle: (n: number) => (n === 1 ? '1 instalada' : `${n} instaladas`),

  suggestedTitle: 'Recomendadas e baixadas',
  allTitle: 'Todas as Bíblias',
  showAll: 'Ver todas as Bíblias',
  hideAll: 'Mostrar menos',
  recommended: 'Recomendada',
  principal: 'Principal',
  principalHint: 'A principal é a do texto do leitor. Toque numa Bíblia baixada para torná-la a principal.',
  setPrincipalA11y: (name: string) => `Usar ${name} como principal`,
  downloadA11y: (name: string) => `Baixar ${name}`,
  removeA11y: (name: string) => `Remover ${name}`,
  cancelA11y: (name: string) => `Parar o download de ${name}`,
  retryA11y: (name: string) => `Baixar ${name} de novo`,
  keepOneTitle: 'Mantenha uma Bíblia',
  keepOneBody: 'O Sensus precisa de pelo menos uma Bíblia baixada. Baixe outra antes de remover esta.',
  catalogCached: 'Mostrando a última lista salva. Atualize quando puder.',
  catalogError: 'Não foi possível atualizar a lista de Bíblias. Confira a conexão.',
  catalogEmpty: 'Nenhuma Bíblia disponível para baixar agora.',
  checking: 'Atualizando…',
  refresh: 'Atualizar lista',

  install: 'Baixar',
  update: 'Atualizar',
  updateAvailable: (v: string) => `Versão ${v} disponível`,
  installed: 'Instalada',
  cancel: 'Cancelar',
  resume: 'Continuar',
  retry: 'Tentar de novo',
  remove: 'Remover',
  removeTitle: (abbr: string) => `Remover ${abbr}?`,
  removeBody: 'O texto desta Bíblia sai do aparelho. Para usar de novo, baixe outra vez.',
  removePrincipalBody: (next: string) => `O texto desta Bíblia sai do aparelho, e ${next} vira a principal.`,
  removeConfirm: 'Remover',
  license: (license: string) => `Licença: ${license}`,
  size: (size: string) => `${size} para baixar`,
  progress: (pct: number) => `Baixando… ${pct}%`,
  phases: {
    checking: 'Preparando…',
    verifying: 'Conferindo o arquivo…',
    extracting: 'Descompactando…',
    installing: 'Instalando…',
  },
  paused: 'Download pausado. Toque em Continuar para baixar de novo.',
  errors: {
    manifest: 'Não foi possível preparar esta Bíblia. Tente de novo.',
    network: 'A conexão caiu durante o download. Tente de novo.',
    space: 'Falta espaço no aparelho para esta Bíblia.',
    'app-too-old': 'Esta versão do app não lê esta Bíblia. Atualize o Sensus.',
    schema: 'Esta versão do app não lê esta Bíblia. Atualize o Sensus.',
    checksum: 'O arquivo baixado não passou na conferência. Tente de novo.',
    corrupt: 'O arquivo baixado está incompleto. Tente de novo.',
    install: 'Não foi possível instalar. Tente de novo.',
    unsupported: 'Esta Bíblia só pode ser baixada no app instalado.',
  } satisfies Record<DataError, string>,

  // Seletor do leitor e aparência
  readerButton: (label: string) => `Bíblia do texto: ${label}. Trocar`,
  readerTitle: 'Bíblia do texto',
  readerDownloadMore: 'Baixar mais Bíblias',
  readerNone: 'Nenhuma Bíblia instalada.',
  appearanceTitle: 'Bíblia padrão',
  textHelp: 'Também muda no leitor, pelo botão da Bíblia na barra superior. Só aparecem as Bíblias instaladas.',
  textMore: 'Para baixar mais, abra Configurações > Bíblias.',
};
export const BIBLE_COPY = localized<typeof ptBibles>({ pt: ptBibles, ...biblesTables });
