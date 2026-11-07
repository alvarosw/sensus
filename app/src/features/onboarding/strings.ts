import { localized } from '../../i18n';
import { onboardingTables } from '../../i18n/locales/all';
// Textos da apresentação de primeira vez (pt-BR). Frases curtas, acolhedoras, sem jargão. O versículo de cada idioma
// fica em verses.ts (é texto de fonte, não tradução).

const ptOnboarding = {
  hint: 'Arraste a candeia para iluminar o texto',
  start: 'Começar',
  skip: 'Pular',
  finale: 'Começar a estudar',
  finaleTitle: 'Tudo pronto',
  finaleBody: 'Sua candeia está acesa. Abra um capítulo, toque num versículo e veja o que cada palavra guarda.',
  stepCount: (n: number, total: number) => `Passo ${n} de ${total}`,

  langTitle: 'Escolha o idioma',
  langHelp: 'O Sensus usa este idioma nos textos e nas recomendações. Você pode mudar depois em Configurações.',

  bibleTitle: 'Uma Bíblia para ler',
  bibleHelp: 'Baixe pelo menos uma tradução. A primeira que você baixar vira a principal, a do texto do leitor.',
  bibleNeedOne: 'Baixe uma Bíblia para continuar.',
  bibleOffline: 'Não foi possível carregar a lista de Bíblias. Confira a conexão e tente de novo.',
  bibleRetry: 'Tentar de novo',
  bibleRequiredTitle: 'Escolha sua Bíblia',
  bibleRequiredHelp: 'As Bíblias agora são baixadas à parte, e o app ficou mais leve. Baixe pelo menos uma para continuar lendo.',

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
