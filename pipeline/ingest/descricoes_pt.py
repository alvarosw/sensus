"""Ingestor: descrições das entidades em português (entity_text), fonte sensus-descricoes-pt.

Duas origens, ambas gravadas em data/staging/sensus-descricoes-pt/entity_text.jsonl:
  a) stepbible-tipnr: traduzidas por regra (sensus/descricoes_pt.py, glossário em corrections/glossario-descricoes.tsv).
     Nomes citados no texto viram o nome pt da entidade ligada (cite_id em data.parents/siblings/partners/offspring
     e a própria entidade, pelo entity_name de nomes_pt.py). Descrição que a regra não reconhece não é traduzida.
  b) theographic e openbible-geo: textos escritos e revisados por agentes de IA, em corrections/descricoes-pt.tsv
     (nota 'rev. IA'). A chave é o sha1 do texto EXATO de entity.description (UTF-8), 16 primeiros hex. Só origem
     revisado entra; cada entidade cuja descrição tem a chave recebe a linha.

Ordem: rodar depois de theographic, stepbible-tipnr, openbible-geo e de nomes_pt.py (precisa dos nomes pt).

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/descricoes_pt.py
"""

import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.descricoes_pt import ler_glossario, traduz_descricao  # noqa: E402
from sensus.names_pt import base_name  # noqa: E402
from sensus.staging import STAGING, StagingWriter  # noqa: E402

SOURCE_ID = "sensus-descricoes-pt"
CORRECOES = Path(__file__).resolve().parent / "corrections"
GLOSSARIO_TSV = CORRECOES / "glossario-descricoes.tsv"
TSV = CORRECOES / "descricoes-pt.tsv"
TIPNR = "stepbible-tipnr"
MANUAIS_FONTES = ("theographic", "openbible-geo")
COLUNAS = ["chave", "fonte", "descricao_pt", "origem", "nota"]
ORIGENS = ("revisado", "sem")
CAMPOS_RELACAO = ("parents", "siblings", "partners", "offspring")


def jsonl(path: Path):
    with open(path, encoding="utf-8") as fh:
        for linha in fh:
            if linha.strip():
                yield json.loads(linha)


def chave_da_descricao(texto: str) -> str:
    """sha1 do texto exato de entity.description (UTF-8), 16 primeiros hex. É a chave do TSV."""
    return hashlib.sha1(texto.encode("utf-8")).hexdigest()[:16]


def decodifica(campo: str) -> str:
    """Campo do TSV: '\\n' vira quebra de linha e '\\\\' vira barra invertida (ver o cabeçalho do TSV)."""
    return re.sub(r"\\(.)", lambda m: "\n" if m.group(1) == "n" else m.group(1), campo)


def ler_tsv(texto: str) -> dict[str, dict]:
    """Linhas revisadas do TSV, pela chave. Comentários e cabeçalho ignorados. Erro para cabeçalho diferente,
    origem fora de revisado/sem, chave repetida ou chave que não é
    sha1[:16] (hex de 16 caracteres)."""
    linhas = [(n, l) for n, l in enumerate(texto.splitlines(), 1) if l.strip() and not l.startswith("#")]
    if not linhas:
        return {}
    (_, cabecalho), *corpo = linhas
    if cabecalho.split("\t") != COLUNAS:
        raise ValueError(f"{TSV.name}: cabeçalho difere do esperado {COLUNAS}: {cabecalho!r}")
    out: dict[str, dict] = {}
    for n, l in corpo:
        campos = (l.split("\t") + [""] * len(COLUNAS))[: len(COLUNAS)]
        r = dict(zip(COLUNAS, campos))
        r["origem"] = r["origem"].strip().lower()
        if r["origem"] not in ORIGENS:
            raise ValueError(f"{TSV.name}, linha {n}: origem inválida {r['origem']!r} (use revisado ou sem)")
        if not re.fullmatch(r"[0-9a-f]{16}", r["chave"]):
            raise ValueError(f"{TSV.name}, linha {n}: chave deve ser sha1[:16] em hex: {r['chave']!r}")
        if r["chave"] in out:
            raise ValueError(f"{TSV.name}, linha {n}: chave repetida {r['chave']}")
        r["descricao_pt"] = decodifica(r["descricao_pt"])
        out[r["chave"]] = r
    return out


def nomes_globais(entidades: list[dict], nomes_pt: dict[str, str]) -> dict[str, str]:
    """Nome inglês-base -> nome pt, quando todas as entidades com esse nome-base têm o mesmo nome pt.
    Cobre citações sem ligação na fonte ('near Babylon'). Nome com dois pt diferentes fica de fora."""
    por_base: dict[str, set[str]] = defaultdict(set)
    for e in entidades:
        pt = nomes_pt.get(e["cite_id"])
        base = base_name(e["name"])
        if pt and base:
            por_base[base].add(pt)
    return {b: next(iter(v)) for b, v in por_base.items() if len(v) == 1}


def nomes_da_entidade(e: dict, dados: dict, nomes_pt: dict[str, str], globais: dict[str, str]) -> dict[str, str]:
    """Nomes que o texto pode citar: os parentes ligados (cite_id) e a própria entidade, com o pt de entity_name.
    O que não está ligado usa o nome pt global (nomes_globais). Chave = nome inglês sem '@ref' e sem sufixo."""
    nomes = dict(globais)
    ligados = [e]
    for campo in CAMPOS_RELACAO:
        for item in dados.get(campo) or []:
            ligados.append({"cite_id": item.get("cite_id"), "name": item.get("name", "").split("@")[0]})
    for item in ligados:
        pt = nomes_pt.get(item.get("cite_id"))
        base = base_name(item["name"].split("@")[0]) if item.get("name") else None
        if pt and base:
            nomes[base] = pt
    return nomes


def main() -> None:
    glos = ler_glossario(GLOSSARIO_TSV.read_text(encoding="utf-8"))
    revisadas = ler_tsv(TSV.read_text(encoding="utf-8")) if TSV.exists() else {}

    # Sufixo numérico ('Abda 2') sai: o texto cita o nome-base ('Abda'). O sufixo fica no nome da entidade.
    nomes_pt = {r["cite_id"]: re.sub(r"\s+\d+$", "", r["name"]) for r in jsonl(STAGING / "sensus-nomes-pt" / "entity_name.jsonl")}
    tudo = []
    for fonte in (TIPNR, *MANUAIS_FONTES):
        tudo += [{**r, "_fonte": fonte} for r in jsonl(STAGING / fonte / "entity.jsonl")]
    globais = nomes_globais(tudo, nomes_pt)

    linhas = []
    por_origem = defaultdict(int)
    tipnr_total = tipnr_ok = 0
    chaves_usadas: set[str] = set()
    for e in tudo:
        desc = e.get("description")
        if not desc or not desc.strip():
            continue
        fonte = e["_fonte"]
        if fonte == TIPNR:
            tipnr_total += 1
            dados = json.loads(e["data"]) if e.get("data") else {}
            nomes = nomes_da_entidade(e, dados, nomes_pt, globais)
            pt = traduz_descricao(desc, glos, nomes)
            if pt is not None:
                tipnr_ok += 1
                por_origem["tipnr por regra"] += 1
                linhas.append((e["cite_id"], pt))
                continue
            por_origem["tipnr sem regra"] += 1
        # Texto revisado do TSV, pela chave do texto em inglês (a coluna fonte é só informativa: o mesmo texto pode
        # vir de mais de uma fonte). Vale para theographic, openbible-geo e o que a regra do TIPNR não cobriu.
        chave = chave_da_descricao(desc)
        r = revisadas.get(chave)
        if r is None:
            continue
        chaves_usadas.add(chave)
        if r["origem"] == "revisado" and r["descricao_pt"].strip():
            por_origem[f"{fonte} revisado"] += 1
            linhas.append((e["cite_id"], r["descricao_pt"]))
        else:
            por_origem[f"{fonte} sem texto pt"] += 1

    meta = json.loads((STAGING / "theographic" / "source.json").read_text(encoding="utf-8"))
    tipnr_meta = json.loads((STAGING / TIPNR / "source.json").read_text(encoding="utf-8"))
    geo_meta = json.loads((STAGING / "openbible-geo" / "source.json").read_text(encoding="utf-8"))
    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="entity",
            title="Descrições das entidades em português (traduzidas e revisadas pelo projeto Sensus)",
            lang="pt",
            license=meta["license"],
            license_url=meta["license_url"],
            url=meta["url"],
            version=f"derivado de theographic ({meta['version']}), stepbible-tipnr ({tipnr_meta['version']}) e "
                    f"openbible-geo ({geo_meta['version']}); pipeline/ingest/descricoes_pt.py",
            attribution=f"{meta['attribution']} {tipnr_meta['attribution']} {geo_meta['attribution']} "
                        "Descrições em português traduzidas e revisadas pelo projeto Sensus.",
            notes="Derivado das descrições em inglês de theographic (CC BY-SA 4.0), stepbible-tipnr (CC BY 4.0) e "
                  "openbible-geo (CC BY 4.0). Share-alike, como a Theographic. TIPNR: tradução por regra do projeto "
                  "(pipeline/sensus/descricoes_pt.py, glossário em pipeline/ingest/corrections/glossario-descricoes.tsv); "
                  "descrição que a regra não cobre não entra. Theographic e openbible-geo: textos escritos e revisados "
                  "por agentes de IA (nota 'rev. IA' em pipeline/ingest/corrections/descricoes-pt.tsv); só os de origem "
                  "revisado entram. Sem tradução automática no aparelho.",
        )
        vistos = set()
        for cite_id, texto in linhas:
            if cite_id in vistos:
                continue
            vistos.add(cite_id)
            w.row("entity_text", cite_id=cite_id, lang="pt", description=texto)

    nao_usadas = sorted(set(revisadas) - chaves_usadas)
    print(f"\nTIPNR: {tipnr_total} descrições com texto; traduzidas por regra: {tipnr_ok} "
          f"({tipnr_ok * 100 // max(tipnr_total, 1)}%)")
    print("Por origem: " + ", ".join(f"{k}={v}" for k, v in sorted(por_origem.items())))
    print(f"Entidades com entity_text: {len(vistos)}")
    if nao_usadas:
        print(f"Chaves do TSV sem entidade na fonte (conferir): {nao_usadas[:20]}")
    print(f"TSV: {TSV}")


if __name__ == "__main__":
    main()
