// Última posição de leitura, persistida em JSON no diretório de documentos (sem segredos).
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { File, Paths } from 'expo-file-system';

export interface LastPosition {
  book: number;
  chapter: number;
  verse?: number;
}

const FILE_NAME = 'last-position.json';

function positionFile(): File {
  return new File(Paths.document, FILE_NAME);
}

function isPosition(value: unknown): value is LastPosition {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
  return ok(v.book) && ok(v.chapter) && (v.verse === undefined || ok(v.verse));
}

export async function readLastPosition(): Promise<LastPosition | null> {
  try {
    const file = positionFile();
    if (!file.exists) return null;
    const parsed: unknown = JSON.parse(await file.text());
    return isPosition(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLastPosition(position: LastPosition): void {
  try {
    const file = positionFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(position));
  } catch {
    // Persistência é só conveniência: falhar não deve interromper a leitura.
  }
}

/** Lê a última posição sempre que a tela ganha foco (ex.: volta da leitura). */
export function useLastPosition(): LastPosition | null {
  const [position, setPosition] = useState<LastPosition | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void readLastPosition().then((p) => {
        if (alive) setPosition(p);
      });
      return () => {
        alive = false;
      };
    }, []),
  );
  return position;
}
