"""Extrai dos cabeçalhos USFM (\\toc1/\\toc2/\\toc3) os nomes dos 66 livros por idioma, como referência para revisão.

A tabela do núcleo (packages/core/src/domain/book-names.ts) é revisada à mão a partir das convenções de cada idioma;
este script não a sobrescreve (grava em pipeline/bibles/out/, fora do repositório).

Fonte dos nomes:
  - pt e en: os nomes que o núcleo já usa (pipeline/sensus/refs.py, espelhado em packages/core/src/refs.ts);
  - demais idiomas: os cabeçalhos \\toc1 (nome), \\toc2 (curto) e \\toc3 (abreviação) da Bíblia de rank 1 do
    idioma no catálogo (pipeline/bibles/catalog.tsv), gravados em data/staging/bibles/<id>/books.json.
Idioma sem Bíblia de rank 1 não entra na tabela: o núcleo cai para o inglês.

O arquivo sai em pipeline/bibles/out/ por padrão. O destino final é packages/core/src/domain/: ele importa
`type { AppLang } from './locale'`, que ainda não existe nesta branch, e tsconfig inclui src/**. Movê-lo quando
locale.ts estiver na main.

Uso (a partir de pipeline/):
    python3 bibles/book_names.py [--out bibles/out/book-names.ts]
"""

import argparse
import csv
import json
import sys
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))

from sensus.refs import BOOKS  # noqa: E402
from sensus.staging import STAGING  # noqa: E402

CATALOG = PIPELINE / "bibles" / "catalog.tsv"
DEFAULT_OUT = PIPELINE / "bibles" / "out" / "book-names.ts"
NUM_BOOKS = 66
CORE_LANGS = ("pt", "en")  # nomes vêm de sensus/refs.py


def ts_str(s: str) -> str:
    """Literal de string em TypeScript com aspas simples."""
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def core_names(lang: str) -> list[dict]:
    """Nomes do núcleo: name = nome completo; short = o mesmo; abbr = primeira abreviação de sensus/refs.py."""
    idx = 2 if lang == "pt" else 3
    out = []
    for row in BOOKS:
        num, name = row[0], row[idx]
        abbr = row[6].split()[0]
        out.append({"book": num, "name": name, "short": name, "abbr": abbr})
    return out


def rank_one_bibles(catalog: list[dict]) -> dict[str, str]:
    """Idioma -> id da Bíblia de rank 1 (só as que têm staging de livros)."""
    picked = {}
    for row in catalog:
        if row["rank"] == "1" and row["ebible"]:
            picked.setdefault(row["lang"], row["id"])
    return picked


def books_of(bible_id: str) -> list[dict]:
    """Nomes de livros de uma Bíblia, a partir do staging. Erro se não houver 66 livros."""
    path = STAGING / "bibles" / bible_id / "books.json"
    rows = json.loads(path.read_text(encoding="utf-8"))
    if len(rows) != NUM_BOOKS:
        raise ValueError(f"{bible_id}: {len(rows)} livros em {path}, esperados {NUM_BOOKS}")
    return [{"book": r["book"], "name": r["name"], "short": r["short"], "abbr": r["abbr"]} for r in rows]


def build_table(catalog: list[dict]) -> dict[str, list[dict]]:
    table: dict[str, list[dict]] = {}
    for lang, bid in sorted(rank_one_bibles(catalog).items()):
        table[lang] = core_names(lang) if lang in CORE_LANGS else books_of(bid)
    for lang in CORE_LANGS:
        table.setdefault(lang, core_names(lang))
    return table


def render(table: dict[str, list[dict]]) -> str:
    lines = [
        "// Gerado por pipeline/bibles/book_names.py. Não editar à mão: rode o gerador de novo.",
        "// Índice = número canônico do livro - 1 (66 livros, ordem protestante). Idioma sem tabela usa inglês.",
        "import type { AppLang } from './locale';",
        "",
        "export interface BookNameEntry {",
        "  name: string;",
        "  short: string;",
        "  abbr: string;",
        "}",
        "",
        "export const BOOK_NAMES: Readonly<Partial<Record<AppLang, readonly BookNameEntry[]>>> = {",
    ]
    for lang in sorted(table, key=lambda k: (k not in CORE_LANGS, k)):  # pt e en primeiro
        lines.append(f"  {lang}: [")
        for b in sorted(table[lang], key=lambda b: b["book"]):
            lines.append(
                f"    {{ name: {ts_str(b['name'])}, short: {ts_str(b['short'])}, abbr: {ts_str(b['abbr'])} }},"
            )
        lines.append("  ],")
    lines.append("};")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()
    with open(CATALOG, encoding="utf-8") as f:
        catalog = list(csv.DictReader(f, delimiter="\t"))
    table = build_table(catalog)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(table), encoding="utf-8")
    print(f"{out}: {len(table)} idiomas ({', '.join(sorted(table))})")


if __name__ == "__main__":
    main()
