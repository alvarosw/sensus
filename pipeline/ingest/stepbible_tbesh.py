"""Ingestor: stepbible-tbesh (TBESH - Translators Brief lexicon of Extended Strongs for Hebrew).

Fonte: STEPBible-Data (CC BY 4.0). Uso: cd pipeline && .venv/bin/python -I ingest/stepbible_tbesh.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sensus.staging import RAW, StagingWriter  # noqa: E402
import stepbible_common as sb  # noqa: E402

SOURCE_ID = "stepbible-tbesh"
REPO_PATH = ("Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew"
             " - STEPBible.org CC BY.txt")


def main():
    path = sb.download(REPO_PATH, RAW / SOURCE_ID / "TBESH.txt")
    rows = sb.read_lexicon_table(sb.read_text(path))
    print(f"[{SOURCE_ID}] linhas de dados: {len(rows)}")
    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="lexicon",
            title="TBESH - Translators Brief Lexicon of Extended Strongs for Hebrew",
            author="STEP Bible (www.STEPBible.org) / Tyndale House Cambridge",
            lang="en",
            license=sb.LICENSE,
            license_url=sb.LICENSE_URL,
            url=sb.REPO_URL,
            version=sb.VERSION,
            attribution=sb.ATTRIBUTION,
            notes="Chave = dStrong (desambiguado). Definições baseadas em BDB (abreviado), "
                  "ligadas aos Strong estendidos (eStrong/dStrong). HTML convertido em texto puro.",
        )
        sb.write_lexicon(w, rows, lang="en")


if __name__ == "__main__":
    main()
