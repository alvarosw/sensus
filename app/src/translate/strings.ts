import { localized } from '../i18n';
import { trTables } from '../i18n/locales/all';
// Textos da tradução automática (pt-BR). Ficam aqui para não mexer nos arquivos de texto das telas. Os nomes de idioma
// que aparecem nas frases são os endônimos (appLangInfo(code).endonym), passados pelo chamador.
const ptTr = {
  offerQuestion: (from: string, to: string) => `Traduzir textos de ${from} para ${to} automaticamente?`,
  offerHelp: '(baixa ~30 MB, funciona offline)',
  offerYes: 'Ativar',
  offerNo: 'Agora não',
  tag: 'Tradução automática',
  showOriginal: 'Ver original',
  showTranslation: 'Ver tradução',
  translating: 'Traduzindo…',
  failed: 'Não foi possível traduzir agora.',
  retry: 'Tentar de novo',
  settingsSection: 'Tradução automática',
  settingsToggle: 'Traduzir textos automaticamente',
  settingsPair: (from: string, to: string) => `Idiomas: ${from} → ${to}`,
  settingsHelp: 'Tradução automática no aparelho; pode conter erros — toque em Ver original.',
  unavailable: 'Indisponível neste aparelho (a tradução automática funciona no Android e no iPhone).',
  modelMissing: 'Não baixado',
  modelOnDemand: 'Baixado quando um texto precisar',
  modelDownloading: 'Baixando modelo…',
  modelReady: 'Pronto no aparelho',
  modelError: 'Falha ao baixar o modelo. Verifique a conexão e ative de novo.',
  modelSize: '~30 MB',
  downloadModel: 'Baixar modelo',
  removeModel: 'Remover modelo',
  removeTitle: 'Remover o modelo de tradução?',
  removeBody: 'A tradução automática será desligada. Para usar de novo, ative a opção (o modelo é baixado outra vez).',
  cancel: 'Cancelar',
  removeConfirm: 'Remover',
  timelineNote: 'Títulos traduzidos automaticamente',
  timelinePartialNote: 'Alguns textos traduzidos automaticamente',
  timelineShowOriginal: 'Ver original',
  timelineOriginalNote: (name: string) => `Mostrando o original (${name})`,
  timelineShowTranslation: 'Ver tradução',
  // Descrição em português da fonte (entity_text): sem aviso de tradução; "Ver original" mostra o original.
  descriptionShowOriginal: 'Ver original',
  descriptionShowPt: (name: string) => `Ver em ${name}`,
  descriptionOriginalNote: (name: string) => `Mostrando o original (${name})`,
};
export const TR = localized<typeof ptTr>({ pt: ptTr, ...trTables });
