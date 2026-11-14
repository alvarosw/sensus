"""Folhas de trabalho para os agentes de revisão dos nomes de uma língua (T1 do plano de línguas).

Grava tmp/traducao/<xx>/nomes-<tipo>-NN.tsv (tmp/ está no .gitignore). Cada folha tem um lote de linhas com o contexto
para decidir: o versículo na língua (até 200 caracteres), o versículo em inglês (engwebp) e o nome pt de referência.

Tipos:
  revisao   linhas auto de confianca media/baixa (nomes.tsv)                      -> aplica_nomes.py
  alta      amostra de linhas auto de confianca alta, para calibrar (--amostra)   -> aplica_nomes.py
  manuais   nomes manuais do pt (nomes-pt-manuais.tsv), para traduzir             -> aplica_nomes.py
  faltando  entidades com nome pt e sem nome nesta língua                          -> aplica_nomes.py
  compostos compostos (glossário pt) que o agente escreve direto no glossário da língua

Respostas (uma linha por linha da folha, mesma ordem), cabeçalho exato:
  revisao/alta:            nome_en  candidato  nome_<xx>  origem  nota
  manuais/faltando:        nome_en  tipo       nome_<xx>  origem  nota

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/folhas_nomes.py --lang es --tipo revisao --lote 300
"""

import argparse
import random
import sys
from collections import defaultdict
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
ROOT = PIPELINE.parent
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import nomes as N  # noqa: E402
from sensus.alinhada import versiculos_kjv  # noqa: E402
from sensus.correcoes import caminho  # noqa: E402
from sensus.linguas import BIBLIA_NOMES, LINGUAS  # noqa: E402
from sensus.names_pt import decompoe, ler_nomes_manuais, split_name  # noqa: E402
from sensus.refs import osis_ref  # noqa: E402
from sensus.staging import STAGING  # noqa: E402

TIPOS = ("revisao", "alta", "manuais", "faltando", "compostos")
ENGLISH = "engwebp"
LIMITE_VERSO = 200


def _limpa(texto: str) -> str:
    return " ".join(texto.replace("\t", " ").split())[:LIMITE_VERSO]


def _entidades_por_nome() -> tuple[dict[str, set[int]], dict[str, dict]]:
    """nome_en (nome-base) -> vids dos versículos das entidades desse nome; e entidades por cite_id."""
    entidades: dict[str, dict] = {}
    refs: dict[str, set[int]] = defaultdict(set)
    for fonte in N.ENTITY_SOURCES:
        for r in N.jsonl(STAGING / fonte / "entity.jsonl"):
            entidades[r["cite_id"]] = r
        for r in N.jsonl(STAGING / fonte / "entity_ref.jsonl"):
            refs[r["entity_cite_id"]].add(r["vid"])
    por_nome: dict[str, set[int]] = defaultdict(set)
    for cid, e in entidades.items():
        partes = split_name(e["name"])
        base = partes[0] if partes is not None else e["name"]
        por_nome[base] |= refs[cid]
    return por_nome, entidades


def _ref_e_versos(vids: set[int], textos: dict[int, str], candidato: str) -> tuple[str, str, str]:
    """(ref, verso na língua, verso em inglês): o primeiro versículo em que o candidato aparece, senão o primeiro."""
    ordenados = sorted(vids)
    escolhido = next((v for v in ordenados if candidato and candidato in textos.get(v, "")), ordenados[0] if ordenados else None)
    if escolhido is None:
        return "", "", ""
    return osis_ref(escolhido), _limpa(textos.get(escolhido, "")), _limpa(EN_TEXTOS.get(escolhido, ""))


EN_TEXTOS: dict[int, str] = {}


def _linhas_folha(lang: str, tipo: str, amostra: int) -> tuple[list[str], list[list[str]]]:
    col = f"nome_{lang}"
    tsv = caminho(lang, "nomes")
    rows = N.ler_tsv(tsv, lang)
    por_nome, _ = _entidades_por_nome()
    pt_tsv = N.ler_tsv(caminho("pt", "nomes"), "pt")
    pt_nome = {(r["nome_en"], r["candidato"]): r["nome_pt"] for r in pt_tsv}
    if tipo in ("revisao", "alta"):
        if tipo == "revisao":
            sel = [r for r in rows if r["origem"] == "auto" and r["confianca"] in ("media", "baixa")]
        else:
            alta = [r for r in rows if r["origem"] == "auto" and r["confianca"] == "alta"]
            random.Random(7).shuffle(alta)
            sel = alta[:amostra] if amostra else alta
        cab = ["nome_en", "candidato", "nome_pt", "alternativa", "versos", "cobertura", "ref", f"verso_{lang}",
               "verso_en"]
        textos = _textos(lang)
        corpo = []
        for r in sel:
            ref, verso, en = _ref_e_versos(por_nome.get(r["nome_en"], set()), textos, r["candidato"])
            corpo.append([r["nome_en"], r["candidato"], pt_nome.get((r["nome_en"], r["candidato"]), ""),
                          r["alternativa"], r["versos"], r["cobertura"], ref, verso, en])
        return cab, corpo
    if tipo == "manuais":
        manuais = ler_nomes_manuais(caminho("pt", "nomes-manuais").read_text(encoding="utf-8"), "pt")
        cab = ["nome_en", "tipo", "nome_pt", "refs"]
        return cab, [[k[0], k[1], m["nome_pt"], _refs(por_nome, k[0])] for k, m in sorted(manuais.items())]
    if tipo == "faltando":
        pt_names = {r["cite_id"]: r["name"] for r in N.jsonl(STAGING / "sensus-nomes-pt" / "entity_name.jsonl")}
        com = {r["cite_id"] for r in N.jsonl(STAGING / f"sensus-nomes-{lang}" / "entity_name.jsonl")} \
            if (STAGING / f"sensus-nomes-{lang}" / "entity_name.jsonl").exists() else set()
        _, entidades = _entidades_por_nome()
        cab = ["nome_en", "tipo", "nome_pt", "refs"]
        vistos: set[tuple[str, str]] = set()
        corpo = []
        for cid, nome_pt in sorted(pt_names.items()):
            e = entidades.get(cid)
            if e is None or cid in com or e["type"] == "event":
                continue
            chave = (e["name"], e["type"])
            if chave in vistos:
                continue
            vistos.add(chave)
            corpo.append([e["name"], e["type"], nome_pt, _refs(por_nome, e["name"])])
        return cab, corpo
    if tipo == "compostos":
        glos_pt = N.ler_glossario("pt")
        _, entidades = _entidades_por_nome()
        cab = ["nome_en", "cabeca", "nucleo", "formas_pt", "refs"]
        vistos = set()
        corpo = []
        for e in entidades.values():
            if e["type"] == "event" or split_name(e["name"]) is not None:
                continue
            comp = decompoe(e["name"], glos_pt)
            if comp and e["name"] not in vistos:
                vistos.add(e["name"])
                corpo.append([e["name"], comp.cabeca, comp.nucleo, "|".join(glos_pt[comp.cabeca]),
                              _refs(por_nome, e["name"])])
        return cab, sorted(corpo)
    raise ValueError(tipo)


def _refs(por_nome: dict[str, set[int]], nome: str) -> str:
    return " ".join(osis_ref(v) for v in sorted(por_nome.get(nome, set()))[:3])


_TEXTOS: dict[str, dict[int, str]] = {}


def _textos(lang: str) -> dict[int, str]:
    if lang not in _TEXTOS:
        textos, _ = versiculos_kjv(BIBLIA_NOMES[lang])
        _TEXTOS[lang] = textos
    return _TEXTOS[lang]


def gravar(lang: str, tipo: str, lote: int, amostra: int) -> list[Path]:
    global EN_TEXTOS
    if not EN_TEXTOS:
        EN_TEXTOS, _ = versiculos_kjv(ENGLISH)
    cab, corpo = _linhas_folha(lang, tipo, amostra)
    pasta = ROOT / "tmp" / "traducao" / lang
    pasta.mkdir(parents=True, exist_ok=True)
    feitos = []
    for i in range(0, max(len(corpo), 1), lote):
        arq = pasta / f"nomes-{tipo}-{i // lote + 1:02d}.tsv"
        linhas = ["\t".join(cab)] + ["\t".join(c) for c in corpo[i:i + lote]]
        arq.write_text("\n".join(linhas) + "\n", encoding="utf-8")
        feitos.append(arq)
    print(f"{lang} {tipo}: {len(corpo)} linhas em {len(feitos)} folha(s) em {pasta}")
    return feitos


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--lang", required=True, choices=list(LINGUAS))
    ap.add_argument("--tipo", required=True, choices=list(TIPOS))
    ap.add_argument("--lote", type=int, default=300)
    ap.add_argument("--amostra", type=int, default=100, help="alta: quantas linhas (0 = todas)")
    a = ap.parse_args()
    gravar(a.lang, a.tipo, a.lote, a.amostra)
