// Texto de cada marca, lido da Bíblia ativa na hora (a marca não guarda texto). Também diz o intervalo a mostrar:
// do primeiro ao último versículo que a Bíblia tem nele; sem nenhum, a marca fica ausente (aviso na linha).
import { useEffect, useState } from 'react';
import type { Mark } from '@/user-data';
import { useRepo } from '@/data/db-context';
import { useStudy } from '@/state/study';
import { useBibles } from '@/data/bibles/bibles-store';
import { bibleRowInfo } from '@/data/bibles/bible-model';
import { visibleRange, type VisibleRange } from './list-model';

export interface MarkText {
  range: VisibleRange;
  text: string;
}

export function useMarkRows(marks: readonly Mark[]): { texts: Map<number, MarkText>; bibleName: string } {
  const repo = useRepo();
  const source = useStudy((s) => s.textSource);
  const catalog = useBibles((s) => s.catalog);
  const [texts, setTexts] = useState<Map<number, MarkText>>(new Map());

  useEffect(() => {
    let alive = true;
    (async () => {
      const out = new Map<number, MarkText>();
      for (const m of marks) {
        const verses = await repo.verseTexts(source, { start: m.startVid, end: m.endVid }, 60);
        out.set(m.id, {
          range: visibleRange({ start: m.startVid, end: m.endVid }, verses.map((v) => v.vid)),
          text: verses.map((v) => v.text).join(' '),
        });
      }
      if (alive) setTexts(out);
    })().catch(() => {
      if (alive) setTexts(new Map());
    });
    return () => {
      alive = false;
    };
  }, [marks, repo, source]);

  return { texts, bibleName: bibleRowInfo(source, catalog).name };
}
