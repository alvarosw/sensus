"""Treasury of Scripture Knowledge (SWORD TSK, zCom) -> source 'sword-tsk' (kind xref).

Cada entrada de versículo é lida pelo índice de slots de sword_common (inclui os
slots de introdução de livro/capítulo, que são pulados aqui). As referências vêm
de <scripRef passage="..."> (ThML) via refparse.find_refs. Gera uma linha xref por
(versículo, intervalo) único; referências do versículo a ele mesmo são descartadas.

Uso: cd pipeline && .venv/bin/python -I ingest/sword_tsk.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import StagingWriter, cite_xr  # noqa: E402
from ingest.refparse import find_refs  # noqa: E402
from ingest.sword_common import download, extract, open_module, raw_entries, read_conf  # noqa: E402

SOURCE_ID = "sword-tsk"
MODULE = "TSK"
RAWZIP = "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/"


def main() -> None:
    zpath = download(f"{MODULE}.zip", SOURCE_ID)
    root = extract(zpath)
    conf = read_conf(root, MODULE)
    version = conf.get("version", "")
    reader = open_module(conf)

    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="xref",
            title="Treasury of Scripture Knowledge",
            author="Canne, Browne, Blayney, Scott et al. (c. 1880)",
            lang="en",
            license="Public Domain",
            license_url=None,
            url=f"{RAWZIP}{MODULE}.zip",
            version=version,
            attribution=(
                f"Treasury of Scripture Knowledge. Módulo SWORD '{MODULE}' v{version}, "
                "distribuído pela CrossWire Bible Society; domínio público."
            ),
            notes="ModDrv=zCom; SourceType=ThML; referências de <scripRef passage>; "
                  "versículos de introdução (v. 0) não geram linhas",
        )
        seen: set[tuple[int, int, int]] = set()
        verses = self_refs = dup = 0
        for v, raw in raw_entries(reader):
            if v % 1000 == 0 or not raw.strip():  # introdução de livro/capítulo ou vazio
                continue
            verses += 1
            for start, end in find_refs(raw):
                if start == v and end == v:
                    self_refs += 1
                    continue
                key = (v, start, end)
                if key in seen:
                    dup += 1
                    continue
                seen.add(key)
                w.row("xref", cite_id=cite_xr(SOURCE_ID, v, start, end), from_vid=v,
                      to_start_vid=start, to_end_vid=end, weight=None)
        print(f"[{SOURCE_ID}] versículos com texto={verses}, auto-referências descartadas={self_refs}, "
              f"duplicadas={dup}")


if __name__ == "__main__":
    main()
