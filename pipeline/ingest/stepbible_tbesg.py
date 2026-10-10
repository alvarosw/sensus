"""Ingestor: stepbible-tbesg (TBESG - Translators Brief lexicon of Extended Strongs for Greek).

Fonte: STEPBible-Data (CC BY 4.0). Uso: cd pipeline && .venv/bin/python -I ingest/stepbible_tbesg.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sensus.staging import RAW, StagingWriter  # noqa: E402
import stepbible_common as sb  # noqa: E402

SOURCE_ID = "stepbible-tbesg"
REPO_PATH = ("Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek"
             " - STEPBible.org CC BY.txt")


def main():
    path = sb.download(REPO_PATH, RAW / SOURCE_ID / "TBESG.txt")
    rows = sb.read_lexicon_table(sb.read_text(path))
    print(f"[{SOURCE_ID}] linhas de dados: {len(rows)}")
    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="lexicon",
            title="TBESG - Translators Brief Lexicon of Extended Strongs for Greek",
            author="STEP Bible (www.STEPBible.org) / Tyndale House Cambridge",
            lang="en",
            license=sb.LICENSE,
            license_url=sb.LICENSE_URL,
            url=sb.REPO_URL,
            version=sb.VERSION,
            attribution=sb.ATTRIBUTION,
            notes="Chave = dStrong (desambiguado). Definições baseadas em Abbott-Smith, "
                  "editadas e complementadas por estudiosos da STEPBible. HTML convertido em texto puro.",
        )
        sb.write_lexicon(w, rows, lang="en")


if __name__ == "__main__":
    main()
