"""Títulos dos eventos por língua (entity_name, fonte sensus-titulos-<xx>): regras puras, sem IO.

Entrada: registros de data/staging/theographic/entity.jsonl com type 'event'. O título em inglês é `name`; o eventID,
o sortKey, os participantes e o verseSort estão no JSON de `data`.

Cada língua tem o seu TSV (coluna titulo_<xx>). O português é o caso original; o nome do módulo ficou por histórico.
Por padrão as funções usam lang="pt", então o código que só trata o português não muda.

Regra de revisão: o título é RASCUNHO até uma pessoa conferir e marcar origem=revisado. Só o revisado vai para o
banco. origem=sem diz "não usar título nesta língua" (o app mostra o inglês). A regeneração preserva o título, a
origem e a nota de cada linha, pela chave cite_id.
"""

import json
from typing import Iterable

from sensus.refs import osis_ref

ORIGENS = ("rascunho", "revisado", "sem")


def colunas(lang: str = "pt") -> list[str]:
    """Colunas do TSV de títulos da língua: event_id, cite_id, titulo_en, titulo_<xx>, origem, nota."""
    return ["event_id", "cite_id", "titulo_en", f"titulo_{lang}", "origem", "nota"]


COLUNAS = colunas("pt")


def eventos_da_fonte(registros: Iterable[dict]) -> list[dict]:
    """Eventos (type 'event') em ordem cronológica (sortKey, depois eventID). Cada um: event_id, cite_id, titulo_en,
    sort_key, ref (referência OSIS do primeiro verso, ou vazio) e participantes ([{cite_id, name}] em inglês)."""
    eventos = []
    for r in registros:
        if r.get("type") != "event":
            continue
        data = r.get("data")
        d = json.loads(data) if isinstance(data, str) else (data or {})
        vs = str(d.get("verseSort") or "").strip()
        eventos.append({
            "event_id": int(d["eventID"]),
            "cite_id": r["cite_id"],
            "titulo_en": r["name"],
            "sort_key": float(d["sortKey"]),
            "ref": osis_ref(int(vs)) if vs.isdigit() else "",
            "participantes": [
                {"cite_id": p["cite_id"], "name": p["name"]} for p in (d.get("participants") or [])
            ],
        })
    if len({e["cite_id"] for e in eventos}) != len(eventos):
        raise ValueError("cite_id de evento repetido na fonte")
    eventos.sort(key=lambda e: (e["sort_key"], e["event_id"]))
    return eventos


def ler_tsv(texto: str, lang: str = "pt") -> list[dict]:
    """Linhas do TSV de revisão (sem comentários #). Cabeçalho diferente ou origem inválida: erro, para não perder
    trabalho de revisão."""
    cols = colunas(lang)
    linhas = [l for l in texto.splitlines() if l.strip() and not l.startswith("#")]
    if not linhas:
        return []
    cabecalho = linhas[0].split("\t")
    if cabecalho != cols:
        raise ValueError(f"cabeçalho do TSV difere de {cols}: {cabecalho}")
    rows = []
    for l in linhas[1:]:
        campos = l.split("\t")
        campos += [""] * (len(cols) - len(campos))
        r = dict(zip(cols, campos[: len(cols)]))
        if r["origem"] not in ORIGENS:
            raise ValueError(f"origem inválida no evento {r['event_id']}: {r['origem']!r}")
        rows.append(r)
    if len({r["cite_id"] for r in rows}) != len(rows):
        raise ValueError("cite_id repetido no TSV")
    return rows


def _limpa(valor) -> str:
    return str(valor).replace("\t", " ").replace("\n", " ").strip()


def escrever_tsv(linhas: list[dict], lang: str = "pt") -> str:
    """Tabela em texto (cabeçalho de colunas + linhas), sem os comentários #, que o ingestor põe por cima."""
    cols = colunas(lang)
    corpo = ["\t".join(cols)]
    corpo += ["\t".join(_limpa(r[c]) for c in cols) for r in linhas]
    return "\n".join(corpo) + "\n"


def mesclar(eventos: list[dict], existentes: list[dict], lang: str = "pt") -> dict:
    """Linhas novas do TSV a partir dos eventos da fonte e das linhas já existentes (chave cite_id).

    - evento já conhecido: o título da língua, origem e nota são preservados; titulo_en e event_id vêm da fonte.
    - evento novo: entra como rascunho, com o título vazio (quem revisa preenche).
    - linha existente cujo evento sumiu da fonte: fica no fim do arquivo, sem entrar no banco.
    Devolve também os avisos: novos, alterados (titulo_en mudou na fonte; reler o título) e sumidos.
    """
    t = f"titulo_{lang}"
    antigos = {r["cite_id"]: r for r in existentes}
    atuais = {e["cite_id"] for e in eventos}
    linhas, novos, alterados = [], [], []
    for e in eventos:
        velha = antigos.get(e["cite_id"])
        if velha is None:
            novos.append(str(e["event_id"]))
            linhas.append({
                "event_id": str(e["event_id"]), "cite_id": e["cite_id"], "titulo_en": e["titulo_en"],
                t: "", "origem": "rascunho", "nota": "",
            })
            continue
        if velha["titulo_en"] != e["titulo_en"]:
            alterados.append(str(e["event_id"]))
        linhas.append({
            "event_id": str(e["event_id"]), "cite_id": e["cite_id"], "titulo_en": e["titulo_en"],
            t: velha[t], "origem": velha["origem"], "nota": velha["nota"],
        })
    sumidos = [r for r in existentes if r["cite_id"] not in atuais]
    linhas += sumidos
    return {
        "linhas": linhas,
        "novos": novos,
        "alterados": alterados,
        "sumidos": [(r["event_id"], r["cite_id"]) for r in sumidos],
    }


def escolher_linhas(linhas: list[dict], cites_atuais: set[str], lang: str = "pt") -> list[tuple[str, str]]:
    """(cite_id, título) que vão para entity_name: origem revisado, com título e evento ainda na fonte.
    Rascunho e sem ficam de fora; revisado sem título também."""
    t = f"titulo_{lang}"
    return [
        (r["cite_id"], r[t].strip())
        for r in linhas
        if r["origem"] == "revisado" and r[t].strip() and r["cite_id"] in cites_atuais
    ]


# ---- participantes e folhas de tradução -------------------------------------

def formata_participantes(participantes: list[dict], nomes: dict[str, str]) -> str:
    """Campo `participantes` da folha: 'Aaron=Аарон; Moses=' (en=xx). Quem ainda não tem nome na língua fica com o
    campo vazio depois do '='; o revisor vê o que falta."""
    return "; ".join(f"{p['name']}={nomes.get(p['cite_id'], '')}" for p in participantes)


def ler_participantes(texto: str) -> list[tuple[str, str]]:
    """Inverso de formata_participantes: [(nome em inglês, nome na língua ou '')]."""
    pares = []
    for parte in texto.split(";"):
        if not parte.strip():
            continue
        en, _, xx = parte.partition("=")
        pares.append((en.strip(), xx.strip()))
    return pares


def faltando_no_titulo(titulo: str, pares: list[tuple[str, str]]) -> list[str]:
    """Nomes na língua (dos participantes que têm nome) que não aparecem no título. Aviso, não erro: um título pode
    usar outra forma do nome de propósito, e quem revisa decide."""
    return [xx for _, xx in pares if xx and xx not in titulo]


FOLHA_FIXAS = ["event_id", "cite_id", "titulo_en", "titulo_pt", "participantes", "ref"]


def colunas_folha(lang: str) -> list[str]:
    """Colunas da folha de tradução: as fixas, a coluna a preencher (titulo_<xx>) e a nota opcional."""
    return FOLHA_FIXAS + [f"titulo_{lang}", "nota"]


def ler_folha(texto: str, lang: str) -> list[dict]:
    """Linhas de uma folha preenchida (sem comentários #). Cabeçalho diferente: erro."""
    cols = colunas_folha(lang)
    linhas = [l for l in texto.splitlines() if l.strip() and not l.startswith("#")]
    if not linhas:
        return []
    cabecalho = linhas[0].split("\t")
    if cabecalho != cols:
        raise ValueError(f"cabeçalho da folha difere de {cols}: {cabecalho}")
    rows = []
    for l in linhas[1:]:
        campos = l.split("\t")
        campos += [""] * (len(cols) - len(campos))
        rows.append(dict(zip(cols, campos[: len(cols)])))
    return rows
