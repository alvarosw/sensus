// Paridade entre BOOK_TABLE (núcleo) e BOOKS de pipeline/sensus/refs.py. Lê o Python como texto,
// sem depender de Python no CI. Confere os dados do livro e que cada apelido do Python resolve para o
// mesmo livro no núcleo (resolveBook).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOK_TABLE, resolveBook } from '../src/refs';

const REFS_PY = new URL('../../../pipeline/sensus/refs.py', import.meta.url);

interface PyBook {
  num: number;
  osis: string;
  namePt: string;
  nameEn: string;
  testament: string;
  chapters: number;
  aliases: string[];
}

/** Lê as tuplas `(num, "osis", "pt", "en", "OT|NT", caps, "aliases")` de BOOKS em refs.py. */
function readPythonBooks(): PyBook[] {
  const src = readFileSync(REFS_PY, 'utf8');
  const re = /\((\d+), "([^"]+)", "([^"]+)", "([^"]+)", "(OT|NT)", (\d+), "([^"]*)"\)/g;
  const out: PyBook[] = [];
  for (const m of src.matchAll(re)) {
    out.push({
      num: Number(m[1]),
      osis: m[2]!,
      namePt: m[3]!,
      nameEn: m[4]!,
      testament: m[5]!,
      chapters: Number(m[6]),
      aliases: m[7]!.split(' ').filter(Boolean),
    });
  }
  return out;
}

describe('BOOK_TABLE × pipeline/sensus/refs.py', () => {
  const py = readPythonBooks();

  it('lê os 66 livros do Python', () => {
    expect(py).toHaveLength(66);
    expect(py.map((b) => b.num)).toEqual(Array.from({ length: 66 }, (_, i) => i + 1));
  });

  it('mesmos números, osis, nomes, testamento e capítulos', () => {
    const ts = BOOK_TABLE.map((b) => ({
      num: b.num,
      osis: b.osis,
      namePt: b.name_pt,
      nameEn: b.name_en,
      testament: b.testament,
      chapters: b.chapters,
    }));
    expect(ts).toEqual(py.map(({ num, osis, namePt, nameEn, testament, chapters }) => ({
      num, osis, namePt, nameEn, testament, chapters,
    })));
  });

  // 'Joe' (tahot.py, EXTRA_BOOKS) não está em refs.ts, mas resolveBook o acha pelo prefixo único ('joe' -> Joel).
  // A checagem é por resolveBook, que é o que o núcleo usa; apelido exato na tabela não é exposto.
  it('todo apelido do Python resolve para o mesmo livro no núcleo', () => {
    const missing: Array<{ alias: string; num: number }> = [];
    for (const b of py) {
      for (const alias of [b.osis, b.namePt, b.nameEn, ...b.aliases]) {
        const found = resolveBook(alias);
        if (found?.num !== b.num) missing.push({ alias, num: b.num });
      }
    }
    expect(missing).toEqual([]);
  });
});
