"""Ingestor: descrições das entidades numa língua (entity_text), fonte sensus-descricoes-<xx>.

Origens, nesta ordem (uma por entidade; a primeira que traduz vale):
  a) stepbible-tipnr: por regra (sensus/descricoes_pt.py) com a gramática e o glossário da língua.
  b) openbible-geo: por regra (sensus/geo_descricao.py), nas línguas que não são pt. No pt continua no TSV (item c).
  c) o que sobrou (theographic; e o TIPNR e o geo que a regra não cobriu): texto revisado do TSV da língua
     (corrections/<xx>/descricoes.tsv; pt: corrections/descricoes-pt.tsv), pela chave sha1[:16] do texto EXATO em
     inglês. Só origem revisado entra.
Arquivos da língua (sensus/correcoes.py): glossario-descricoes, gramatica-descricoes, glossario-geo, descricoes.
Gramática ou glossário ausentes = língua sem tradução por regra (0 descrições, sem erro).
Nomes citados: entity_name de data/staging/sensus-nomes-<xx>/ (sem essa fonte, o nome fica em inglês ou a descrição
falha, conforme nome_ingles_permitido da gramática).

Uso (raiz do repositório), depois de theographic, stepbible-tipnr, openbible-geo e dos nomes da língua:
    python3 pipeline/ingest/descricoes.py --lang es [--relatorio]
--relatorio: lista os termos e chaves que a regra não achou (para acrescentar ao glossário ou à gramática).
"""

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.book_abbr import abreviaturas  # noqa: E402
from sensus.correcoes import caminho  # noqa: E402
from sensus.descricoes_pt import GRAMATICA_PT, ler_glossario, ler_gramatica, traduz_descricao  # noqa: E402
from sensus.geo_descricao import SECOES_GEO, analisa, renderiza  # noqa: E402
from sensus.linguas import LINGUAS, NOME_PT  # noqa: E402
from sensus.names_pt import base_name  # noqa: E402
from sensus.staging import STAGING, StagingWriter  # noqa: E402

CORRECOES = Path(__file__).resolve().parent / "corrections"
TIPNR = "stepbible-tipnr"
THEO = "theographic"
GEO = "openbible-geo"
FONTES = (TIPNR, THEO, GEO)
ORIGENS = ("revisado", "sem")
CAMPOS_RELACAO = ("parents", "siblings", "partners", "offspring")


def source_id(lang: str) -> str:
    return f"sensus-descricoes-{lang}"


def jsonl(path: Path):
    with open(path, encoding="utf-8") as fh:
        for linha in fh:
            if linha.strip():
                yield json.loads(linha)


def ler_texto(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def chave_da_descricao(texto: str) -> str:
    """sha1 do texto exato de entity.description (UTF-8), 16 primeiros hex. É a chave do TSV."""
    return hashlib.sha1(texto.encode("utf-8")).hexdigest()[:16]


def decodifica(campo: str) -> str:
    """Campo do TSV: '\\n' vira quebra de linha e '\\\\' vira barra invertida (ver o cabeçalho do TSV)."""
    return re.sub(r"\\(.)", lambda m: "\n" if m.group(1) == "n" else m.group(1), campo)


def codifica(texto: str) -> str:
    """Inverso de decodifica: para gravar um texto de várias linhas num campo do TSV."""
    return texto.replace("\\", "\\\\").replace("\n", "\\n")


def colunas(lang: str) -> list[str]:
    return ["chave", "fonte", f"descricao_{lang}", "origem", "nota"]


def ler_tsv(texto: str, lang: str = "pt", nome: str | None = None) -> dict[str, dict]:
    """Linhas revisadas do TSV, pela chave. Comentários e cabeçalho ignorados. Erro para cabeçalho diferente,
    origem fora de revisado/sem, chave repetida ou chave que não é sha1[:16] (hex de 16 caracteres)."""
    nome = nome or caminho(lang, "descricoes").name
    cols = colunas(lang)
    linhas = [(n, l) for n, l in enumerate(texto.splitlines(), 1) if l.strip() and not l.startswith("#")]
    if not linhas:
        return {}
    (_, cabecalho), *corpo = linhas
    if cabecalho.split("\t") != cols:
        raise ValueError(f"{nome}: cabeçalho difere do esperado {cols}: {cabecalho!r}")
    out: dict[str, dict] = {}
    for n, l in corpo:
        campos = (l.split("\t") + [""] * len(cols))[: len(cols)]
        r = dict(zip(cols, campos))
        r["origem"] = r["origem"].strip().lower()
        if r["origem"] not in ORIGENS:
            raise ValueError(f"{nome}, linha {n}: origem inválida {r['origem']!r} (use revisado ou sem)")
        if not re.fullmatch(r"[0-9a-f]{16}", r["chave"]):
            raise ValueError(f"{nome}, linha {n}: chave deve ser sha1[:16] em hex: {r['chave']!r}")
        if r["chave"] in out:
            raise ValueError(f"{nome}, linha {n}: chave repetida {r['chave']}")
        r[f"descricao_{lang}"] = decodifica(r[f"descricao_{lang}"])
        out[r["chave"]] = r
    return out


def nomes_globais(entidades: list[dict], nomes: dict[str, str]) -> dict[str, str]:
    """Nome inglês-base -> nome da língua, quando todas as entidades com esse nome-base têm o mesmo nome.
    Cobre citações sem ligação na fonte ('near Babylon'). Nome com dois nomes diferentes fica de fora."""
    por_base: dict[str, set[str]] = {}
    for e in entidades:
        pt = nomes.get(e["cite_id"])
        base = base_name(e["name"])
        if pt and base:
            por_base.setdefault(base, set()).add(pt)
    return {b: next(iter(v)) for b, v in por_base.items() if len(v) == 1}


def nomes_da_entidade(e: dict, dados: dict, nomes: dict[str, str], globais: dict[str, str]) -> dict[str, str]:
    """Nomes que o texto pode citar: os parentes ligados (cite_id) e a própria entidade, com o nome da língua de
    entity_name. O que não está ligado usa o nome global (nomes_globais). Chave = nome inglês sem '@ref' e sufixo."""
    out = dict(globais)
    ligados = [e]
    for campo in CAMPOS_RELACAO:
        for item in dados.get(campo) or []:
            ligados.append({"cite_id": item.get("cite_id"), "name": item.get("name", "").split("@")[0]})
    for item in ligados:
        pt = nomes.get(item.get("cite_id"))
        base = base_name(item["name"].split("@")[0]) if item.get("name") else None
        if pt and base:
            out[base] = pt
    return out


def nomes_da_lingua(lang: str) -> dict[str, str]:
    """cite_id -> nome da língua (entity_name de sensus-nomes-<xx>), sem o sufixo numérico ('Abda 2' -> 'Abda').
    Sem a fonte de nomes, vazio: o pipeline roda igual, só que com nomes em inglês."""
    arquivo = STAGING / f"sensus-nomes-{lang}" / "entity_name.jsonl"
    if not arquivo.exists():
        return {}
    return {r["cite_id"]: re.sub(r"\s+\d+$", "", r["name"]) for r in jsonl(arquivo)}


@dataclass
class Contexto:
    lang: str
    glos: dict
    gram: dict
    glos_geo: dict
    abrevs: list[str]
    nomes: dict[str, str]
    globais: dict[str, str]
    revisadas: dict[str, dict]
    tudo: list[dict]

    @property
    def geo_por_regra(self) -> bool:
        return self.lang != "pt"


def contexto(lang: str) -> Contexto:
    """Lê tudo que a tradução precisa (arquivos da língua e staging das fontes). Não grava nada."""
    glos = ler_glossario(ler_texto(caminho(lang, "glossario-descricoes")))
    gram = dict(GRAMATICA_PT) if lang == "pt" else ler_gramatica(ler_texto(caminho(lang, "gramatica-descricoes")))
    glos_geo = ler_glossario(ler_texto(caminho(lang, "glossario-geo")), SECOES_GEO)
    revisadas = ler_tsv(ler_texto(caminho(lang, "descricoes")), lang)
    nomes = nomes_da_lingua(lang)
    tudo = []
    for fonte in FONTES:
        tudo += [{**r, "_fonte": fonte} for r in jsonl(STAGING / fonte / "entity.jsonl")]
    return Contexto(lang=lang, glos=glos, gram=gram, glos_geo=glos_geo, abrevs=abreviaturas(lang), nomes=nomes,
                    globais=nomes_globais(tudo, nomes), revisadas=revisadas, tudo=tudo)


def traduz(e: dict, ctx: Contexto, falhas: list[str]) -> tuple[str | None, str]:
    """(texto na língua, via): via 'regra' (TIPNR ou geo), 'tsv' (revisado) ou '' (sem tradução)."""
    desc = e["description"]
    if e["_fonte"] == TIPNR:
        dados = json.loads(e["data"]) if e.get("data") else {}
        nomes = nomes_da_entidade(e, dados, ctx.nomes, ctx.globais)
        texto = traduz_descricao(desc, ctx.glos, nomes, ctx.gram, ctx.abrevs, falhas)
        if texto is not None:
            return texto, "regra"
    elif e["_fonte"] == GEO and ctx.geo_por_regra:
        geo = analisa(desc)
        if geo is not None:
            nomes = nomes_da_entidade(e, {}, ctx.nomes, ctx.globais)
            texto = renderiza(geo, ctx.glos_geo, ctx.gram, falhas, lingua=ctx.lang, nomes=nomes)
            if texto is not None:
                return texto, "regra"
    r = ctx.revisadas.get(chave_da_descricao(desc))
    if r is not None and r["origem"] == "revisado" and r[f"descricao_{ctx.lang}"].strip():
        return r[f"descricao_{ctx.lang}"], "tsv"
    return None, ""


def metadados(ctx: Contexto) -> dict:
    """Campos de source.json. O texto do pt é o de sempre (ingest/descricoes_pt.py é o ponto de entrada dele)."""
    meta = json.loads((STAGING / THEO / "source.json").read_text(encoding="utf-8"))
    tipnr = json.loads((STAGING / TIPNR / "source.json").read_text(encoding="utf-8"))
    geo = json.loads((STAGING / GEO / "source.json").read_text(encoding="utf-8"))
    lang = ctx.lang
    entrada = "pipeline/ingest/descricoes_pt.py" if lang == "pt" else f"pipeline/ingest/descricoes.py --lang {lang}"
    tsv = caminho(lang, "descricoes").relative_to(Path(__file__).resolve().parents[1].parent)
    glossario = caminho(lang, "glossario-descricoes").relative_to(Path(__file__).resolve().parents[1].parent)
    if lang == "pt":
        parte_geo = (f"Theographic e openbible-geo: textos escritos e revisados por agentes de IA (nota 'rev. IA' em "
                     f"{tsv}); só os de origem revisado entram.")
    else:
        parte_geo = (f"openbible-geo: regra do projeto (pipeline/sensus/geo_descricao.py, glossário geo em "
                     f"pipeline/ingest/corrections/{lang}/glossario-geo.tsv). Theographic: textos escritos e revisados "
                     f"por agentes de IA (nota 'rev. IA' em {tsv}); só os de origem revisado entram.")
    return {
        "kind": "entity",
        "title": f"Descrições das entidades em {NOME_PT[lang]} (traduzidas e revisadas pelo projeto Sensus)",
        "lang": lang,
        "license": meta["license"],
        "license_url": meta["license_url"],
        "url": meta["url"],
        "version": f"derivado de theographic ({meta['version']}), stepbible-tipnr ({tipnr['version']}) e "
                   f"openbible-geo ({geo['version']}); {entrada}",
        "attribution": f"{meta['attribution']} {tipnr['attribution']} {geo['attribution']} "
                       f"Descrições em {NOME_PT[lang]} traduzidas e revisadas pelo projeto Sensus.",
        "notes": "Derivado das descrições em inglês de theographic (CC BY-SA 4.0), stepbible-tipnr (CC BY 4.0) e "
                 "openbible-geo (CC BY 4.0). Share-alike, como a Theographic. TIPNR: tradução por regra do projeto "
                 f"(pipeline/sensus/descricoes_pt.py, {'glossário' if lang == 'pt' else 'gramática e glossário da língua'} "
                 f"em {glossario if lang == 'pt' else f'pipeline/ingest/corrections/{lang}/'}); "
                 f"descrição que a regra não cobre não entra. {parte_geo} "
                 "Sem tradução automática no aparelho.",
    }


def main(lang: str, relatorio: bool = False) -> None:
    if lang != "pt" and lang not in LINGUAS:
        raise SystemExit(f"língua desconhecida: {lang!r} (use pt ou uma de {', '.join(LINGUAS)})")
    ctx = contexto(lang)
    falhas: list[str] = []
    origem: Counter = Counter()
    linhas: list[tuple[str, str]] = []
    usadas: set[str] = set()
    tipnr_total = 0
    for e in ctx.tudo:
        desc = e.get("description")
        if not desc or not desc.strip():
            continue
        fonte = e["_fonte"]
        if fonte == TIPNR:
            tipnr_total += 1
        if chave_da_descricao(desc) in ctx.revisadas:
            usadas.add(chave_da_descricao(desc))
        texto, via = traduz(e, ctx, falhas)
        if texto is None:
            origem[f"{fonte} sem tradução"] += 1
            continue
        origem[f"{fonte} {'por regra' if via == 'regra' else 'revisado'}"] += 1
        linhas.append((e["cite_id"], texto))

    with StagingWriter(source_id(lang)) as w:
        w.source(**metadados(ctx))
        vistos: set[str] = set()
        for cite_id, texto in linhas:
            if cite_id in vistos:
                continue
            vistos.add(cite_id)
            w.row("entity_text", cite_id=cite_id, lang=lang, description=texto)

    por_regra = origem[f"{TIPNR} por regra"]
    print(f"\n[{lang}] TIPNR: {tipnr_total} descrições com texto; por regra: {por_regra} "
          f"({por_regra * 100 // max(tipnr_total, 1)}%)")
    print("Por origem: " + ", ".join(f"{k}={v}" for k, v in sorted(origem.items())))
    print(f"Entidades com entity_text: {len(vistos)}")
    nao_usadas = sorted(set(ctx.revisadas) - usadas)
    if nao_usadas:
        print(f"Chaves do TSV sem entidade na fonte (conferir): {nao_usadas[:20]}")
    if relatorio:
        print("Trechos que a regra não achou (acrescentar ao glossário, à gramática ou ao TSV):")
        for trecho, n in Counter(falhas).most_common(60):
            print(f"  {n:6d}  {trecho}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--lang", required=True, help="pt ou uma das 12 línguas do app")
    parser.add_argument("--relatorio", action="store_true", help="lista o que a regra não achou")
    args = parser.parse_args()
    main(args.lang, args.relatorio)
