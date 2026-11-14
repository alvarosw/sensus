"""Ingestor dos títulos em português (entity_name, fonte sensus-titulos-pt). Invólucro de titulos.py --lang pt: o
português mantém o caminho de sempre (o TSV legado titulos-eventos-pt.tsv e a fonte sensus-titulos-pt).

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/titulos_pt.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from titulos import main  # noqa: E402

if __name__ == "__main__":
    main("pt")
