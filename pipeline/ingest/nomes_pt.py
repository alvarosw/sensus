"""Ingestor: nomes próprios em português (entity_name), derivados da Bíblia Livre. Invólucro de nomes.py --lang pt.

O método, as entradas e as saídas estão em pipeline/ingest/nomes.py (o mesmo para todas as línguas). Aqui ficam só
os caminhos do pt, que continuam os arquivos legados: corrections/nomes-pt.tsv, nomes-pt-manuais.tsv etc.
(ver sensus/correcoes.py). Escolha automática sem IA; linhas de confiança média/baixa revisadas por agentes de IA
(notas em corrections/nomes-pt-revisao.tsv).

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/nomes_pt.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import nomes as N  # noqa: E402
from sensus.correcoes import caminho  # noqa: E402

TSV = caminho("pt", "nomes")
COLUNAS = N.colunas("pt")


def ler_tsv():
    return N.ler_tsv(TSV, "pt")


def main() -> None:
    N.main("pt")


if __name__ == "__main__":
    main()
