// Ponte para o módulo nativo SensusTranslate (Google ML Kit, Android e iOS). Sem ele, a tradução fica indisponível.
// Os pares são de idiomas do app (AppLang); a ponte converte para o código do ML Kit (campo mlkit de APP_LANGS).
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { appLangInfo, type AppLang, type TranslationPair } from '@sensus/core';

interface SensusTranslateNative {
  /** Os dois modelos do par (origem e destino) estão no aparelho. */
  status(from: string, to: string): Promise<boolean>;
  /** Baixa os modelos do par se faltarem. */
  download(from: string, to: string): Promise<void>;
  /** Traduz trechos na ordem recebida. */
  translate(texts: string[], from: string, to: string): Promise<string[]>;
  /** Apaga os modelos baixados, exceto o inglês. */
  removeModels(): Promise<void>;
}

const mod: SensusTranslateNative | null =
  Platform.OS === 'android' || Platform.OS === 'ios'
    ? requireOptionalNativeModule<SensusTranslateNative>('SensusTranslate')
    : null;

/** true quando o aparelho pode traduzir (Android ou iOS com o módulo nativo). */
export const translationSupported: boolean = mod !== null;

function need(): SensusTranslateNative {
  if (!mod) throw new Error('translation-unavailable');
  return mod;
}

/** Código do ML Kit (TranslateLanguage) de um idioma do app. */
export function mlkitTag(lang: AppLang): string {
  return appLangInfo(lang).mlkit ?? lang;
}

/** Os modelos do par estão no aparelho. Sem o módulo, false. */
export const modelReady = (pair: TranslationPair): Promise<boolean> => need().status(mlkitTag(pair.from), mlkitTag(pair.to));
/** Baixa os modelos do par se faltarem. Sem indicador de progresso: o ML Kit não informa o percentual. */
export const downloadModel = (pair: TranslationPair): Promise<void> => need().download(mlkitTag(pair.from), mlkitTag(pair.to));
/** Traduz trechos do par, na mesma ordem. */
export const translateRuns = (texts: string[], pair: TranslationPair): Promise<string[]> =>
  need().translate(texts, mlkitTag(pair.from), mlkitTag(pair.to));
/** Apaga os modelos baixados do aparelho, exceto o inglês (ele é compartilhado por todos os pares). */
export const removeModels = (): Promise<void> => need().removeModels();
