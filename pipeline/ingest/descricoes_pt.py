"""Ingestor: descrições das entidades em português (entity_text), fonte sensus-descricoes-pt.

Invólucro de descricoes.py --lang pt, mantido porque o README e o histórico chamam este caminho. A lógica (TIPNR por
regra, theographic e openbible-geo pelo TSV corrections/descricoes-pt.tsv, nomes pt de entity_name) está em descricoes.py.

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/descricoes_pt.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from descricoes import CORRECOES, chave_da_descricao, decodifica, ler_tsv, main as _main  # noqa: E402,F401

TSV = CORRECOES / "descricoes-pt.tsv"


def main() -> None:
    _main("pt")


if __name__ == "__main__":
    main()
