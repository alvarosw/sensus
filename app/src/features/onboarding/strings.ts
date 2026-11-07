import { localized } from '../../i18n';
import { onboardingTables } from '../../i18n/locales/all';
// Textos da apresentação de primeira vez (pt-BR). Frases curtas, acolhedoras, sem jargão. O versículo de cada idioma
// fica em verses.ts (é texto de fonte, não tradução).

const ptOnboarding = {
  hint: 'Arraste a candeia para iluminar o texto',
  start: 'Começar',
  skip: 'Pular',
  finale: 'Entrar no Sensus',
  stepCount: (n: number, total: number) => `Passo ${n} de ${total}`,

  langTitle: 'Escolha o idioma',
  langHelp: 'O Sensus usa este idioma nos textos e nas recomendações. Você pode mudar depois em Configurações.',

  bibleTitle: 'Uma Bíblia para ler',
  bibleHelp: 'Escolha a tradução do texto. A Bíblia Livre e a KJV já vêm no app.',
  bibleRecommended: 'Recomendada para o seu idioma',
  bibleOthers: 'Outras deste idioma',
  bibleNone: 'Ainda não há uma Bíblia livre recomendada para este idioma. Você pode ver outras em Configurações.',
  bibleOffline: 'Não foi possível carregar a lista de Bíblias agora. Você pode baixar uma depois, em Configurações.',

  traditionsTitle: 'Vertente teológica',
  traditionsHelp: 'Quais comentários e interpretações você quer ver no estudo?',
  traditionsNote: 'Você pode mudar isso em Configurações.',

  aiTitle: 'Um assistente para perguntar',
  aiBody: 'A IA resume cada trecho e responde às suas perguntas citando as fontes do Sensus. Nada que ela gera é gravado no aparelho.',
  aiConfigure: 'Configurar agora',

  continueLabel: 'Continuar',
  dataContinueBackground: 'Continuar enquanto baixa',
  revisit: 'Rever a apresentação',
};

export type OnboardingCopyShape = typeof ptOnboarding;

export const ONBOARDING_COPY = localized<typeof ptOnboarding>({ pt: ptOnboarding, ...onboardingTables });
