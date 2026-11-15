"""Caminhos dos arquivos de correção (TSV revisados) por língua.

O português usa os arquivos legados, já versionados em pipeline/ingest/corrections/ (nomes-pt.tsv etc.). As outras
línguas usam corrections/<xx>/<tipo>.tsv. Função pura: só monta o caminho, não cria nem lê nada.
"""

from pathlib import Path

from sensus.linguas import LINGUAS

CORRECOES = Path(__file__).resolve().parents[1] / "ingest" / "corrections"

TIPOS = frozenset({
    "nomes", "nomes-manuais", "nomes-revisao", "glossario-compostos", "titulos-eventos",
    "gramatica-descricoes", "glossario-descricoes", "glossario-geo", "descricoes",
})

# pt: nomes dos arquivos que já existem. Os demais tipos de pt ainda não têm arquivo: seguem o padrão <tipo>-pt.tsv.
LEGADO_PT = {
    "nomes": "nomes-pt.tsv",
    "nomes-manuais": "nomes-pt-manuais.tsv",
    "nomes-revisao": "nomes-pt-revisao.tsv",
    "glossario-compostos": "glossario-compostos.tsv",
    "titulos-eventos": "titulos-eventos-pt.tsv",
    "glossario-descricoes": "glossario-descricoes.tsv",
    "descricoes": "descricoes-pt.tsv",
}


def caminho(lang: str, tipo: str) -> Path:
    """Caminho do TSV de correções de `tipo` na língua `lang` (pt ou uma de LINGUAS)."""
    if tipo not in TIPOS:
        raise ValueError(f"tipo de correção desconhecido: {tipo!r}")
    if lang == "pt":
        return CORRECOES / LEGADO_PT.get(tipo, f"{tipo}-pt.tsv")
    if lang not in LINGUAS:
        raise ValueError(f"língua fora de LINGUAS: {lang!r}")
    return CORRECOES / lang / f"{tipo}.tsv"
