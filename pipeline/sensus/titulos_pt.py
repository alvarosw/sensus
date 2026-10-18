"""Títulos dos eventos em português (entity_name, fonte sensus-titulos-pt): regras puras, sem IO.

Entrada: registros de data/staging/theographic/entity.jsonl com type 'event'. O título em inglês é `name`; o eventID
e o sortKey estão no JSON de `data`.

Regra de revisão: o título pt é RASCUNHO até uma pessoa conferir e marcar origem=revisado. Só o revisado vai para o
banco. origem=sem diz "não usar título pt" (o app mostra o inglês). A regeneração preserva titulo_pt, origem e nota
de cada linha, pela chave cite_id.
"""

import json
from typing import Iterable

COLUNAS = ["event_id", "cite_id", "titulo_en", "titulo_pt", "origem", "nota"]
ORIGENS = ("rascunho", "revisado", "sem")


def eventos_da_fonte(registros: Iterable[dict]) -> list[dict]:
    """Eventos (type 'event') em ordem cronológica (sortKey, depois eventID). Cada um: event_id, cite_id, titulo_en."""
    eventos = []
    for r in registros:
        if r.get("type") != "event":
            continue
        data = r.get("data")
        d = json.loads(data) if isinstance(data, str) else (data or {})
        eventos.append({
            "event_id": int(d["eventID"]),
            "cite_id": r["cite_id"],
            "titulo_en": r["name"],
            "sort_key": float(d["sortKey"]),
        })
    if len({e["cite_id"] for e in eventos}) != len(eventos):
        raise ValueError("cite_id de evento repetido na fonte")
    eventos.sort(key=lambda e: (e["sort_key"], e["event_id"]))
    return eventos


def ler_tsv(texto: str) -> list[dict]:
    """Linhas do TSV de revisão (sem comentários #). Cabeçalho diferente ou origem inválida: erro, para não perder
    trabalho de revisão."""
    linhas = [l for l in texto.splitlines() if l.strip() and not l.startswith("#")]
    if not linhas:
        return []
    cabecalho = linhas[0].split("\t")
    if cabecalho != COLUNAS:
        raise ValueError(f"cabeçalho do TSV difere de {COLUNAS}: {cabecalho}")
    rows = []
    for l in linhas[1:]:
        campos = l.split("\t")
        campos += [""] * (len(COLUNAS) - len(campos))
        r = dict(zip(COLUNAS, campos[: len(COLUNAS)]))
        if r["origem"] not in ORIGENS:
            raise ValueError(f"origem inválida no evento {r['event_id']}: {r['origem']!r}")
        rows.append(r)
    if len({r["cite_id"] for r in rows}) != len(rows):
        raise ValueError("cite_id repetido no TSV")
    return rows


def _limpa(valor) -> str:
    return str(valor).replace("\t", " ").replace("\n", " ").strip()


def escrever_tsv(linhas: list[dict]) -> str:
    """Tabela em texto (cabeçalho de colunas + linhas), sem os comentários #, que o ingestor põe por cima."""
    corpo = ["\t".join(COLUNAS)]
    corpo += ["\t".join(_limpa(r[c]) for c in COLUNAS) for r in linhas]
    return "\n".join(corpo) + "\n"


def mesclar(eventos: list[dict], existentes: list[dict]) -> dict:
    """Linhas novas do TSV a partir dos eventos da fonte e das linhas já existentes (chave cite_id).

    - evento já conhecido: titulo_pt, origem e nota são preservados; titulo_en e event_id vêm da fonte.
    - evento novo: entra como rascunho, com titulo_pt vazio (quem revisa preenche).
    - linha existente cujo evento sumiu da fonte: fica no fim do arquivo, sem entrar no banco.
    Devolve também os avisos: novos, alterados (titulo_en mudou na fonte; reler o pt) e sumidos.
    """
    antigos = {r["cite_id"]: r for r in existentes}
    atuais = {e["cite_id"] for e in eventos}
    linhas, novos, alterados = [], [], []
    for e in eventos:
        velha = antigos.get(e["cite_id"])
        if velha is None:
            novos.append(str(e["event_id"]))
            linhas.append({
                "event_id": str(e["event_id"]), "cite_id": e["cite_id"], "titulo_en": e["titulo_en"],
                "titulo_pt": "", "origem": "rascunho", "nota": "",
            })
            continue
        if velha["titulo_en"] != e["titulo_en"]:
            alterados.append(str(e["event_id"]))
        linhas.append({
            "event_id": str(e["event_id"]), "cite_id": e["cite_id"], "titulo_en": e["titulo_en"],
            "titulo_pt": velha["titulo_pt"], "origem": velha["origem"], "nota": velha["nota"],
        })
    sumidos = [r for r in existentes if r["cite_id"] not in atuais]
    linhas += sumidos
    return {
        "linhas": linhas,
        "novos": novos,
        "alterados": alterados,
        "sumidos": [(r["event_id"], r["cite_id"]) for r in sumidos],
    }


def escolher_linhas(linhas: list[dict], cites_atuais: set[str]) -> list[tuple[str, str]]:
    """(cite_id, titulo_pt) que vão para entity_name: origem revisado, com título pt e evento ainda na fonte.
    Rascunho e sem ficam de fora; revisado sem título pt também."""
    return [
        (r["cite_id"], r["titulo_pt"].strip())
        for r in linhas
        if r["origem"] == "revisado" and r["titulo_pt"].strip() and r["cite_id"] in cites_atuais
    ]
