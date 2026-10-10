"""Dicionários e índices tópicos SWORD (CrossWire), todos em domínio público.

kind 'dictionary': Easton, ISBE, Smith, Hitchcock
kind 'topical':    Nave, Torrey

Cada verbete vira dictionary_entry (cite_id dic:<source>:<slug>) e cada referência
bíblica encontrada no verbete vira entry_ref. Duplicatas de chave (ex.: dois "AB"
no Smith) recebem sufixo "-2", "-3"... no slug para manter o cite_id único.

Uso: cd pipeline && .venv/bin/python -I ingest/sword_dicts.py [Module ...]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import StagingWriter, cite_dic  # noqa: E402
from ingest.refparse import find_refs  # noqa: E402
from ingest.sword_common import download, extract  # noqa: E402
from ingest.sword_ld import LexDictModule, to_plain  # noqa: E402

RAWZIP = "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/"

# module, source_id, kind, título, autor
MODULES = [
    ("Easton", "sword-easton", "dictionary",
     "Easton's Illustrated Bible Dictionary (1897)", "M. G. Easton"),
    ("ISBE", "sword-isbe", "dictionary",
     "International Standard Bible Encyclopedia", "James Orr (ed. geral); J. L. Nuelsen; E. Y. Mullins; M. O. Evans; M. G. Kyle"),
    ("Smith", "sword-smith", "dictionary",
     "Smith's Bible Dictionary", "William Smith"),
    ("Hitchcock", "sword-hitchcock", "dictionary",
     "Hitchcock's Bible Names Dictionary", "Roswell D. Hitchcock"),
    ("Nave", "sword-nave", "topical",
     "Nave's Topical Bible", "Orville J. Nave"),
    ("Torrey", "sword-torrey", "topical",
     "Torrey's New Topical Textbook", "R. A. Torrey"),
]


def ingest(module: str, source_id: str, kind: str, title: str, author: str) -> None:
    zpath = download(f"{module}.zip", source_id)
    root = extract(zpath)
    mod = LexDictModule(root)
    conf = mod.conf
    version = conf.get("Version", "")
    attribution = (
        f"{author}. {title}. Módulo SWORD '{module}' v{version}, distribuído pela "
        f"CrossWire Bible Society; domínio público (DistributionLicense=Public Domain)."
    )
    notes = (f"ModDrv={mod.drv}; SourceType={conf.get('SourceType', '')}; "
             f"TextSource={conf.get('TextSource', '')}; SWORD module {module} v{version}")

    with StagingWriter(source_id) as w:
        w.source(
            kind=kind,
            title=title,
            author=author,
            lang="en",
            license="Public Domain",
            license_url=None,
            url=f"{RAWZIP}{module}.zip",
            version=version,
            attribution=attribution,
            notes=notes,
        )
        used: set[str] = set()
        skipped = 0
        for key, raw in mod.entries():
            text = to_plain(raw)
            if not text:
                skipped += 1
                continue
            cite = cite_dic(source_id, key)
            n = 1
            while cite in used:
                n += 1
                cite = cite_dic(source_id, f"{key} {n}")
            used.add(cite)
            w.row("dictionary_entry", cite_id=cite, headword=key, text=text)
            for start, end in find_refs(raw):
                w.row("entry_ref", entry_cite_id=cite, start_vid=start, end_vid=end)
        if skipped:
            print(f"[{source_id}] {skipped} verbetes vazios ignorados")


def main(argv: list[str]) -> None:
    wanted = set(argv)
    for module, source_id, kind, title, author in MODULES:
        if wanted and module not in wanted:
            continue
        ingest(module, source_id, kind, title, author)


if __name__ == "__main__":
    main(sys.argv[1:])
