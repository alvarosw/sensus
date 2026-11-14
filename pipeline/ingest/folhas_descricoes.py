"""Folhas de trabalho dos agentes de tradução das descrições, por língua: tmp/traducao/<xx>/descricoes-<tipo>-NN.tsv.

Tipos:
  gramatica  chave, referencia_pt: as chaves da gramática (a resposta é chave<TAB>modelo).
             Chaves geo_* mostram a frase de origem em inglês na referencia.
  geo        secao, ingles, exemplo_en, n: termos do openbible-geo que o glossário geo da língua ainda não tem,
             do mais frequente para o menos (a resposta segue o formato do glossário).
  prosa      chave, fonte, prioridade, participa_linha, refs, texto_en, nomes: textos que a regra não traduz
             (theographic e o que sobrou do TIPNR e do geo). Ordem de prioridade: participante de evento da linha do
             tempo primeiro; depois a soma de entity_ref das entidades com o texto. A resposta traz descricao_<xx>.

Uso (raiz do repositório):
    python3 pipeline/ingest/folhas_descricoes.py --lang es --tipo prosa --lote 100
Formato das respostas: ver pipeline/ingest/aplica_descricoes.py.
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
ROOT = PIPELINE.parent
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from descricoes import FONTES, GEO, THEO, chave_da_descricao, codifica, contexto, jsonl, nomes_da_entidade, traduz  # noqa: E402
from sensus.descricoes_pt import GRAMATICA_PT  # noqa: E402
from sensus.geo_descricao import CHAVES_GEO, EXEMPLO_EN, analisa  # noqa: E402
from sensus.linguas import LINGUAS  # noqa: E402
from sensus.names_pt import base_name  # noqa: E402
from sensus.staging import STAGING  # noqa: E402

TIPOS = ("gramatica", "geo", "prosa")


def escreve(lang: str, tipo: str, cabecalho: list[str], linhas: list[list[str]], lote: int) -> list[Path]:
    """Grava as linhas em arquivos de `lote` linhas (NN a partir de 01) e devolve os caminhos."""
    pasta = ROOT / "tmp" / "traducao" / lang
    pasta.mkdir(parents=True, exist_ok=True)
    out = []
    for i in range(0, max(len(linhas), 1), lote):
        arquivo = pasta / f"descricoes-{tipo}-{i // lote + 1:02d}.tsv"
        corpo = linhas[i:i + lote]
        texto = "\t".join(cabecalho) + "\n" + "".join("\t".join(c) + "\n" for c in corpo)
        arquivo.write_text(texto, encoding="utf-8")
        out.append(arquivo)
    return out


def folha_gramatica(lang: str) -> tuple[list[str], list[list[str]]]:
    chaves = [*GRAMATICA_PT, *CHAVES_GEO]
    linhas = [[k, GRAMATICA_PT.get(k, EXEMPLO_EN.get(k, ""))] for k in chaves]
    return ["chave", "referencia_pt"], linhas


def pares_geo(texto: str) -> list[tuple[str, str]]:
    """(seção do glossário geo, termo em inglês) usados numa descrição do openbible-geo."""
    geo = analisa(texto)
    if geo is None:
        return []
    pares = [("tipo", geo.tipo), ("geometria", geo.geometria)]
    if geo.fonte:
        pares.append(("fonte", geo.fonte))
    pares += [("voto", k) for k, _ in geo.votos]
    return pares


def folha_geo(ctx) -> tuple[list[str], list[list[str]]]:
    faltam: Counter = Counter()
    exemplo: dict[tuple[str, str], str] = {}
    for e in ctx.tudo:
        if e["_fonte"] != GEO or not e.get("description"):
            continue
        for secao, termo in pares_geo(e["description"]):
            if termo in ctx.glos_geo.get(secao, {}):
                continue
            faltam[(secao, termo)] += 1
            exemplo.setdefault((secao, termo), e["name"])
    linhas = [[secao, termo, exemplo[(secao, termo)], str(n)] for (secao, termo), n in faltam.most_common()]
    return ["secao", "ingles", "exemplo_en", "n"], linhas


def participantes() -> tuple[set[str], set[str]]:
    """cite_ids e nomes-base dos participantes de eventos da linha do tempo (Theographic, campo participants)."""
    ids: set[str] = set()
    nomes: set[str] = set()
    for r in jsonl(STAGING / THEO / "entity.jsonl"):
        if r.get("type") != "event" or not r.get("data"):
            continue
        for p in json.loads(r["data"]).get("participants") or []:
            if p.get("cite_id"):
                ids.add(p["cite_id"])
            base = base_name(p["name"]) if p.get("name") else None
            if base:
                nomes.add(base)
    return ids, nomes


def contagem_refs() -> Counter:
    """entity_ref por cite_id de entidade, somando as fontes de descrição."""
    refs: Counter = Counter()
    for fonte in FONTES:
        arquivo = STAGING / fonte / "entity_ref.jsonl"
        if arquivo.exists():
            refs.update(r["entity_cite_id"] for r in jsonl(arquivo))
    return refs


def folha_prosa(ctx) -> tuple[list[str], list[list[str]]]:
    """Textos que a regra não traduz, por prioridade (a soma de refs e a participação na linha do tempo)."""
    ids_part, nomes_part = participantes()
    refs = contagem_refs()
    por_chave: dict[str, dict] = {}
    for e in ctx.tudo:
        desc = e.get("description")
        if not desc or not desc.strip():
            continue
        texto, _ = traduz(e, ctx, [])
        if texto is not None:
            continue
        r = por_chave.setdefault(chave_da_descricao(desc), {
            "fonte": set(), "texto": desc, "refs": 0, "linha": False, "nomes": {},
        })
        r["fonte"].add(e["_fonte"])
        r["refs"] += refs.get(e["cite_id"], 0)
        r["linha"] = r["linha"] or e["cite_id"] in ids_part or base_name(e["name"]) in nomes_part
        dados = json.loads(e["data"]) if e.get("data") else {}
        r["nomes"].update(nomes_da_entidade(e, dados, ctx.nomes, {}))
    ordem = sorted(por_chave.items(), key=lambda kv: (-kv[1]["linha"], -kv[1]["refs"], kv[0]))
    linhas = []
    for i, (chave, r) in enumerate(ordem, 1):
        nomes = "; ".join(f"{en}={pt}" for en, pt in sorted(r["nomes"].items()))
        linhas.append([chave, "+".join(sorted(r["fonte"])), str(i), "1" if r["linha"] else "0", str(r["refs"]),
                       codifica(r["texto"]), nomes])
    return ["chave", "fonte", "prioridade", "participa_linha", "refs", "texto_en", "nomes"], linhas


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--lang", required=True, help="uma das 12 línguas do app")
    parser.add_argument("--tipo", required=True, choices=TIPOS)
    parser.add_argument("--lote", type=int, default=100, help="linhas por arquivo (padrão 100)")
    args = parser.parse_args()
    if args.lang not in LINGUAS:
        raise SystemExit(f"língua desconhecida: {args.lang!r} (use uma de {', '.join(LINGUAS)})")
    ctx = contexto(args.lang)
    if args.tipo == "gramatica":
        cabecalho, linhas = folha_gramatica(args.lang)
    elif args.tipo == "geo":
        cabecalho, linhas = folha_geo(ctx)
    else:
        cabecalho, linhas = folha_prosa(ctx)
    arquivos = escreve(args.lang, args.tipo, cabecalho, linhas, args.lote)
    print(f"[{args.lang}] {args.tipo}: {len(linhas)} linhas em {len(arquivos)} arquivo(s) em {arquivos[0].parent}")
    for arquivo in arquivos[:3]:
        print(f"  {arquivo.name}")
    if len(arquivos) > 3:
        print(f"  ... até {arquivos[-1].name}")


if __name__ == "__main__":
    main()
