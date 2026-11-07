// Idiomas da interface do app (14). Fonte única: código, BCP-47, endônimo, direção do texto e os códigos dos motores
// de tradução (ML Kit e Apple Translation). Domínio puro, sem imports (ver docs/ARCHITECTURE.md §2).
// Contrato e ordem: docs/design/idiomas-biblias-fontes.md §1.

export type AppLang = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'ru' | 'zh' | 'hi' | 'ar' | 'bn' | 'ur' | 'id' | 'ja' | 'vi';

export interface AppLangInfo {
  code: AppLang;
  /** BCP-47 para datas, IA e Intl: 'pt-BR', 'en', 'zh-Hans', ... */
  bcp47: string;
  /** Nome do idioma escrito nele mesmo, para a lista de Configurações. */
  endonym: string;
  /** Escrita da direita para a esquerda (ar, ur). Fase 1: só o texto muda, o layout não espelha. */
  rtl: boolean;
  /** Código do ML Kit (TranslateLanguage). Nulo se o ML Kit não tem o idioma. */
  mlkit: string | null;
  /** Código do Apple Translation. Nulo onde o framework não tem o idioma. */
  apple: string | null;
}

/** Na ordem da tabela do contrato (as 13 primeiras por falantes totais, e o português). */
export const APP_LANGS: readonly AppLangInfo[] = [
  { code: 'pt', bcp47: 'pt-BR', endonym: 'Português', rtl: false, mlkit: 'pt', apple: 'pt-BR' },
  { code: 'en', bcp47: 'en', endonym: 'English', rtl: false, mlkit: 'en', apple: 'en' },
  { code: 'zh', bcp47: 'zh-Hans', endonym: '中文（简体）', rtl: false, mlkit: 'zh', apple: 'zh-Hans' },
  { code: 'hi', bcp47: 'hi', endonym: 'हिन्दी', rtl: false, mlkit: 'hi', apple: 'hi' },
  { code: 'es', bcp47: 'es', endonym: 'Español', rtl: false, mlkit: 'es', apple: 'es' },
  { code: 'ar', bcp47: 'ar', endonym: 'العربية', rtl: true, mlkit: 'ar', apple: 'ar' },
  { code: 'fr', bcp47: 'fr', endonym: 'Français', rtl: false, mlkit: 'fr', apple: 'fr' },
  { code: 'bn', bcp47: 'bn', endonym: 'বাংলা', rtl: false, mlkit: 'bn', apple: null },
  { code: 'ru', bcp47: 'ru', endonym: 'Русский', rtl: false, mlkit: 'ru', apple: 'ru' },
  { code: 'id', bcp47: 'id', endonym: 'Bahasa Indonesia', rtl: false, mlkit: 'id', apple: 'id' },
  { code: 'ur', bcp47: 'ur', endonym: 'اردو', rtl: true, mlkit: 'ur', apple: null },
  { code: 'de', bcp47: 'de', endonym: 'Deutsch', rtl: false, mlkit: 'de', apple: 'de' },
  { code: 'ja', bcp47: 'ja', endonym: '日本語', rtl: false, mlkit: 'ja', apple: 'ja' },
  { code: 'vi', bcp47: 'vi', endonym: 'Tiếng Việt', rtl: false, mlkit: 'vi', apple: 'vi' },
];

export const DEFAULT_APP_LANG: AppLang = 'pt';

const FALLBACK_LAST: AppLang = 'en';
const CODES: readonly string[] = APP_LANGS.map((l) => l.code);

/** Informação de um idioma. Lança erro se o código não for um dos 14 (o tipo já impede, mas JS não).  */
export function appLangInfo(code: AppLang): AppLangInfo {
  const info = APP_LANGS.find((l) => l.code === code);
  if (!info) throw new RangeError(`idioma desconhecido: ${String(code)}`);
  return info;
}

export function isAppLang(x: unknown): x is AppLang {
  return typeof x === 'string' && CODES.includes(x);
}

/** Código principal de uma tag ("zh-Hans-CN" -> "zh"; "pt_BR" -> "pt"). Vazio -> null. */
function baseOf(tag: string): string | null {
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  return base ? base : null;
}

/**
 * Idioma inicial pelo aparelho: a primeira tag da lista cujo código principal está nos 14 idiomas; sem nenhuma, inglês.
 * Ex.: ['fr-CA', 'pt-BR'] -> 'fr'; ['sw-KE'] -> 'en'.
 */
export function appLangFromDevice(tags: readonly string[]): AppLang {
  for (const tag of tags) {
    const base = baseOf(tag);
    if (base && isAppLang(base)) return base;
  }
  return FALLBACK_LAST;
}

/**
 * Cadeia de fallback dos textos: o idioma escolhido, depois inglês, depois português (sem repetição).
 * Para quem não lê português, inglês é melhor que pt; o pt é a fonte do tipo dos textos.
 */
export function fallbackChain(lang: AppLang): AppLang[] {
  return [...new Set<AppLang>([lang, FALLBACK_LAST, DEFAULT_APP_LANG])];
}

/** Primeiro valor da tabela na cadeia de fallback do idioma; undefined se nenhum idioma da cadeia tem valor. */
export function pickLang<T>(table: Partial<Record<AppLang, T>>, lang: AppLang): T | undefined {
  for (const l of fallbackChain(lang)) {
    const value = table[l];
    if (value !== undefined) return value;
  }
  return undefined;
}
