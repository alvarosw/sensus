// Ponte para o módulo nativo SensusTranslate (Google ML Kit, Android e iOS). Sem ele, a tradução fica indisponível.
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

interface SensusTranslateNative {
  status(): Promise<boolean>;
  download(): Promise<void>;
  translate(texts: string[]): Promise<string[]>;
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

/** Os dois modelos (inglês e português) estão no aparelho. */
export const modelReady = (): Promise<boolean> => need().status();
/** Baixa os modelos se faltarem. Sem indicador de progresso: o ML Kit não informa o percentual. */
export const downloadModel = (): Promise<void> => need().download();
/** Traduz trechos em inglês, na mesma ordem. */
export const translateRuns = (texts: string[]): Promise<string[]> => need().translate(texts);
/** Apaga os modelos do aparelho. */
export const removeModel = (): Promise<void> => need().removeModels();
