"""Ingestor: referências cruzadas do OpenBible.info (CC BY 4.0) -> xref.

Fonte: https://a.openbible.info/data/cross-references.zip (cross_references.txt, TSV):
    From Verse<TAB>To Verse<TAB>Votes
    Gen.1.1<TAB>Col.1.16-Col.1.17<TAB>173
Os votos podem ser negativos; todas as linhas são mantidas e o voto vai em `weight`.

Uso:
    cd pipeline && .venv/bin/python -I ingest/openbible-xref.py
"""

import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import requests  # noqa: E402

from sensus.refs import BOOK_BY_NUM, book_num, vid  # noqa: E402
from sensus.staging import RAW, StagingWriter, cite_xr  # noqa: E402

SOURCE_ID = "openbible-xref"
URL = "https://a.openbible.info/data/cross-references.zip"
RAW_DIR = RAW / SOURCE_ID
ZIP_PATH = RAW_DIR / "cross-references.zip"


def download() -> None:
    if ZIP_PATH.exists() and ZIP_PATH.stat().st_size > 0:
        return
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    r = requests.get(URL, timeout=180)
    r.raise_for_status()
    tmp = ZIP_PATH.with_suffix(".part")
    tmp.write_bytes(r.content)
    tmp.replace(ZIP_PATH)


def parse_osis(ref: str) -> int:
    """'Gen.1.1' / '1John.2.3' -> vid (sem remapeamento de versificação)."""
    book, ch, vs = ref.strip().split(".")
    b = book_num(book)
    c, v = int(ch), int(vs)
    if not 1 <= c <= BOOK_BY_NUM[b][5]:
        raise ValueError(f"capítulo fora do intervalo: {ref!r}")
    if v < 1:
        raise ValueError(f"versículo inválido: {ref!r}")
    return vid(b, c, v)


def main() -> None:
    download()
    with zipfile.ZipFile(ZIP_PATH) as z:
        name = next(n for n in z.namelist() if n.endswith(".txt"))
        lines = z.read(name).decode("utf-8").splitlines()
    if not lines[0].startswith("From Verse"):
        raise RuntimeError(f"cabeçalho inesperado: {lines[0]!r}")

    seen = set()
    skipped = dup = 0
    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="xref",
            title="OpenBible.info Cross References",
            author="OpenBible.info",
            lang="en",
            license="CC-BY-4.0",
            license_url="https://creativecommons.org/licenses/by/4.0/",
            url="https://www.openbible.info/labs/cross-references/",
            version="2026-10-05 (data da linha de cabeçalho de cross_references.txt)",
            attribution=(
                "Referências cruzadas: OpenBible.info (https://www.openbible.info/labs/cross-references/), "
                "licença Creative Commons Attribution 4.0 (CC BY 4.0)."
            ),
            notes=(
                "weight = votos da fonte; pode ser negativo (1.242 linhas). Nenhuma linha descartada. "
                "Versículos usados como vêm na fonte (OSIS), sem remapeamento para a versificação KJV. "
                "Só a atribuição é exigida (sem share-alike)."
            ),
        )
        for line in lines[1:]:
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) != 3:
                skipped += 1
                continue
            frm, to, votes = parts
            from_vid = parse_osis(frm)
            ends = to.split("-")
            start = parse_osis(ends[0])
            end = parse_osis(ends[-1])
            if end < start:
                raise ValueError(f"intervalo invertido: {frm} -> {to}")
            key = (from_vid, start, end)
            if key in seen:
                dup += 1
                continue
            seen.add(key)
            w.row(
                "xref",
                cite_id=cite_xr(SOURCE_ID, from_vid, start, end),
                from_vid=from_vid,
                to_start_vid=start,
                to_end_vid=end,
                weight=float(votes),
            )
    print(f"linhas ignoradas (formato): {skipped}; duplicadas: {dup}")


if __name__ == "__main__":
    main()
