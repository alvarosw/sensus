"""Ingestor: stepbible-tflsj (TFLSJ - Translators Formatted full LSJ Bible lexicon, 0-5624 + extra).

Fonte: STEPBible-Data (CC BY 4.0). Uso: cd pipeline && .venv/bin/python -I ingest/stepbible_tflsj.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sensus.staging import RAW, StagingWriter  # noqa: E402
import stepbible_common as sb  # noqa: E402

SOURCE_ID = "stepbible-tflsj"
PARTS = {
    "Lexicons/TFLSJ  0-5624 - Translators Formatted full LSJ Bible lexicon - STEPBible.org CC BY.txt":
        "TFLSJ_0-5624.txt",
    "Lexicons/TFLSJ extra - Translators Formatted full LSJ Bible lexicon - STEPBible.org CC BY.txt":
        "TFLSJ_extra.txt",
}


def main():
    seen: set = set()
    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="lexicon",
            title="TFLSJ - Translators Formatted Full LSJ Bible Lexicon",
            author="LSJ (Liddell, Scott, Jones), formatado por STEP Bible / Tyndale House Cambridge",
            lang="en",
            license=sb.LICENSE,
            license_url=sb.LICENSE_URL,
            url=sb.REPO_URL,
            version=sb.VERSION,
            attribution=sb.ATTRIBUTION + " Base: Liddell-Scott-Jones (LSJ), formatada por Tyndale House.",
            notes="Léxico LSJ completo para as palavras da Bíblia grega (0-5624 + extra), chaveado por dStrong. "
                  "Referências de citação (hover 'Refs ...') foram removidas do texto; "
                  "o texto grego da entrada está em 'lemma' e o verbete em inglês em 'definition'.",
        )
        for repo_path, local in PARTS.items():
            path = sb.download(repo_path, RAW / SOURCE_ID / local)
            rows = sb.read_lexicon_table(sb.read_text(path))
            print(f"[{SOURCE_ID}] {local}: linhas de dados {len(rows)}")
            sb.write_lexicon(w, rows, lang="en", seen=seen)


if __name__ == "__main__":
    main()
