// Preferências da tradução no aparelho (ligada/desligada e se a oferta já foi respondida). Sem textos traduzidos.
import { File, Paths } from 'expo-file-system';

export interface StoredTranslatePrefs {
  enabled: boolean;
  /** "Ativar" ou "Agora não" já foi escolhido: a oferta não aparece de novo. */
  offerAnswered: boolean;
}

const FILE_NAME = 'translate-prefs.json';

export async function readTranslatePrefs(): Promise<StoredTranslatePrefs | null> {
  try {
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) return null;
    const parsed: unknown = JSON.parse(await file.text());
    return parsed && typeof parsed === 'object' ? (parsed as StoredTranslatePrefs) : null;
  } catch {
    return null;
  }
}

export function writeTranslatePrefs(prefs: StoredTranslatePrefs): void {
  try {
    new File(Paths.document, FILE_NAME).write(JSON.stringify(prefs));
  } catch {
    // sem escrita: vale até fechar o app
  }
}
