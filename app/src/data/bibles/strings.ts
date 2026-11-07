// Textos das Bíblias baixadas (pt-BR): Configurações > Bíblias, Aparência e o seletor do leitor.
import type { DataError } from '../download-machine';
import { localized } from '../../i18n';
import { enBibles } from '../../i18n/locales/en/bibles';

const ptBibles = {
  title: 'Bíblias',
  rowTitle: 'Bíblias',
  rowSubtitle: (n: number) => (n === 1 ? '1 instalada' : `${n} instaladas`),

  installedTitle: 'Instaladas',
  recommendedTitle: (lang: string) => `Recomendadas para ${lang}`,
  othersTitle: 'Outros idiomas',
  recommended: 'Recomendada',
  bundledNote: 'Vêm com o app e não podem ser removidas.',
  catalogCached: 'Mostrando a última lista salva. Atualize quando puder.',
  catalogError: 'Não foi possível atualizar a lista de Bíblias. Confira a conexão.',
  catalogEmpty: 'Nenhuma Bíblia disponível para baixar agora.',
  checking: 'Atualizando…',
  refresh: 'Atualizar lista',

  install: 'Baixar',
  installed: 'Instalada',
  cancel: 'Cancelar',
  resume: 'Continuar',
  retry: 'Tentar de novo',
  remove: 'Remover',
  removeTitle: (abbr: string) => `Remover ${abbr}?`,
  removeBody: 'O texto desta Bíblia sai do aparelho. Para usar de novo, baixe outra vez.',
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
    install: 'Não foi possível instalar. O texto continua disponível. Tente de novo.',
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
export const BIBLE_COPY = localized<typeof ptBibles>({ pt: ptBibles, en: enBibles });
