"""Ingestor: nomes próprios em português (entity_name), derivados da Bíblia Livre. Sem IA e sem tradução automática.

Entrada (staging, rodar depois dos ingestores): entity e entity_ref de theographic, stepbible-tipnr e
openbible-geo; verse_text de blivre. A escolha do candidato está em sensus/names_pt.py. Compostos ('Mount Sinai')
usam corrections/glossario-compostos.tsv (cabeças inglesas -> formas pt) e são calculados depois dos nomes simples,
porque a frase usa o nome pt do núcleo.

Cálculo: por ENTIDADE (com os versículos dela), não pelo nome-base. Duas pessoas com o mesmo nome inglês
(Noah: Noé em Gênesis, Noa em Números) recebem candidatos diferentes. As entidades com o mesmo nome-base
e o mesmo candidato formam uma linha, identificada por (nome_en, candidato).

Saídas:
  a) pipeline/ingest/corrections/nomes-pt.tsv, versionado, para revisão humana. Linhas origem=auto são
     recalculadas a cada execução; origem=revisado e origem=sem são preservadas (chave nome_en + candidato).
  b) data/staging/sensus-nomes-pt/ (entity_name): uma linha por entidade (não evento) cuja linha tem nome pt
     utilizável (origem revisado com nome, ou auto com confianca alta).

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/nomes_pt.py
"""

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.names_pt import (  # noqa: E402
    Composto, avalia, candidates, choose, decompoe, escolhe_frase, gentilico, split_name,
)
from sensus.staging import STAGING, StagingWriter  # noqa: E402

SOURCE_ID = "sensus-nomes-pt"
ENTITY_SOURCES = ["theographic", "stepbible-tipnr", "openbible-geo"]
TSV = Path(__file__).resolve().parent / "corrections" / "nomes-pt.tsv"
GLOSSARIO_TSV = Path(__file__).resolve().parent / "corrections" / "glossario-compostos.tsv"
COLUNAS = ["nome_en", "candidato", "nome_pt", "origem", "confianca", "entidades", "versos", "cobertura", "alternativa"]
ORDEM_CONFIANCA = {"baixa": 0, "media": 1, "alta": 2}
CABECALHO = [
    "# Nomes próprios em português: nome em inglês (nome-base, sem sufixo numérico) -> nome pt da Bíblia Livre.",
    "# Gerado por pipeline/ingest/nomes_pt.py. Uma linha por (nome_en, candidato). Colunas:",
    "#   nome_en      nome-base inglês das fontes de entidades",
    "#   candidato    escolha automática na Bíblia Livre; identifica a linha (não editar)",
    "#   nome_pt      valor final, que o revisor edita (começa igual a candidato)",
    "#   origem       auto (calculado) | revisado (decisão humana) | sem (não usar nome pt)",
    "#   confianca    alta | media | baixa (limiares em pipeline/sensus/names_pt.py)",
    "#   entidades    quantas entidades (fontes x pessoas/lugares) caem nesta linha",
    "#   versos       versículos do nome que existem na Bíblia Livre",
    "#   cobertura    fração desses versículos em que o candidato aparece",
    "#   alternativa  segundo colocado, para conferir",
    "# Compostos (Mount Sinai, Valley of Elah): cabeça do glossário + núcleo; o candidato é a frase como está na",
    "# Bíblia Livre (nome pt = com maiúscula inicial). Não achada: candidato = forma do glossário + núcleo, confianca baixa.",
    "# Revisão: comece pelas linhas de confianca baixa. Para aceitar outro nome, troque nome_pt e marque",
    "# origem=revisado. Para o app mostrar o nome inglês, marque origem=sem. Linhas revisado e sem não são",
    "# recalculadas ao rodar o ingestor de novo.",
]


def jsonl(path: Path):
    with open(path, encoding="utf-8") as fh:
        for linha in fh:
            if linha.strip():
                yield json.loads(linha)


def ler_glossario() -> dict[str, tuple[str, ...]]:
    """Cabeças inglesas dos compostos -> formas pt (corrections/glossario-compostos.tsv)."""
    glossario = {}
    for linha in GLOSSARIO_TSV.read_text(encoding="utf-8").splitlines():
        if not linha.strip() or linha.startswith("#") or linha.startswith("cabeca\t"):
            continue
        cabeca, formas = linha.split("\t")
        glossario[cabeca] = tuple(f for f in formas.split("|") if f)
    return glossario


def ler_tsv() -> list[dict]:
    """Linhas do TSV de revisão (sem comentários e cabeçalho). Vazio se não existe ou tem outro formato."""
    if not TSV.exists():
        return []
    linhas = [
        l for l in TSV.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")
    ]
    cabecalho, *corpo = linhas
    if cabecalho.split("\t") != COLUNAS:
        print(f"aviso: {TSV.name} está em outro formato; as linhas antigas não são preservadas")
        return []
    return [dict(zip(COLUNAS, (l.split("\t") + [""] * len(COLUNAS))[: len(COLUNAS)])) for l in corpo]


def escrever_tsv(linhas: list[dict]) -> None:
    linhas.sort(key=lambda r: (ORDEM_CONFIANCA.get(r["confianca"], 3), r["nome_en"], r["candidato"]))
    corpo = ["\t".join(COLUNAS)] + ["\t".join(r[c] for c in COLUNAS) for r in linhas]
    TSV.write_text("\n".join(CABECALHO + corpo) + "\n", encoding="utf-8")


def main() -> None:
    verses = {r["vid"]: r["text"] for r in jsonl(STAGING / "blivre" / "verse_text.jsonl")}
    vc = {v: candidates(t) for v, t in verses.items()}
    df = Counter(c for s in vc.values() for c in s)

    entidades: dict[str, dict] = {}
    refs: dict[str, set[int]] = defaultdict(set)
    for fonte in ENTITY_SOURCES:
        for r in jsonl(STAGING / fonte / "entity.jsonl"):
            entidades[r["cite_id"]] = r
        for r in jsonl(STAGING / fonte / "entity_ref.jsonl"):
            refs[r["entity_cite_id"]].add(r["vid"])

    # 1) Cada entidade escolhe o seu candidato com os seus próprios versículos.
    # 2) Entidades com a mesma chave (nome-base, candidato) formam uma linha do TSV.
    # Preferência do nome-base: o candidato escolhido com todas as entidades do nome juntas. A entidade fica com
    # ele quando aparece em pelo menos metade dos versículos dela (James, filho de Zebedeu, com Tiago, onde João
    # co-ocorre; Noé e Noa não se misturam). Senão, vale o candidato da própria entidade.
    partes_de = {cid: split_name(e["name"]) for cid, e in entidades.items()}
    versos_base: dict[str, set[int]] = defaultdict(set)
    for cid, partes in partes_de.items():
        if partes is not None:
            versos_base[partes[0]] |= refs[cid]
    preferido = {b: choose(b, V, vc, df).nome for b, V in versos_base.items()}

    grupos: dict[tuple[str, str], dict] = {}
    chave_entidade: dict[str, tuple[str, str]] = {}
    sem_versos = 0
    # Compostos ('Mount Sinai'): decompostos aqui, frases escolhidas depois da parte simples (precisam dos nomes pt).
    glossario = ler_glossario()
    comp_ents: dict[str, Composto] = {}
    compostos = fora_comp = 0
    for cid, e in entidades.items():
        partes = partes_de[cid]
        if partes is None:
            compostos += 1
            if e["type"] != "event":
                comp = decompoe(e["name"], glossario)
                if comp:
                    comp_ents[cid] = comp
                else:
                    fora_comp += 1
            continue
        base = partes[0]
        esc = choose(base, refs[cid], vc, df)
        if esc.nome is None:
            sem_versos += 1
            continue
        pref = preferido.get(base)
        V = [v for v in refs[cid] if v in vc]
        if pref and pref != esc.nome and V and sum(1 for v in V if pref in vc[v]) * 2 >= len(V):
            esc = avalia(base, pref, refs[cid], vc, df, esc.nome)
        chave = (base, esc.nome)
        chave_entidade[cid] = chave
        g = grupos.setdefault(chave, {"cids": [], "versos": set(), "alts": Counter()})
        g["cids"].append(cid)
        g["versos"] |= refs[cid]
        if esc.alternativa:
            g["alts"][esc.alternativa] += 1

    # TSV: preserva revisado e sem (pela chave); recalcula auto.
    existentes = ler_tsv()
    preservadas = [r for r in existentes if r["origem"] in ("revisado", "sem")]
    chaves_preservadas = {(r["nome_en"], r["candidato"]) for r in preservadas}
    linhas = list(preservadas)
    via2 = 0
    for (base, c), g in grupos.items():
        if (base, c) in chaves_preservadas:
            continue
        alt = next((a for a, _ in g["alts"].most_common() if a != c), None)
        e = avalia(base, c, g["versos"], vc, df, alt)
        if e.confianca == "alta" and e.semelhanca < 0.8:
            via2 += 1  # alta pela segunda via (grafia diferente)
        linhas.append({
            "nome_en": base,
            "candidato": c,
            "nome_pt": c,
            "origem": "auto",
            "confianca": e.confianca,
            "entidades": str(len(g["cids"])),
            "versos": str(e.versos),
            "cobertura": f"{e.cobertura:.2f}",
            "alternativa": alt or "",
        })
    # Compostos: uma linha por (nome-base, frase). Núcleo com nome pt (linhas alta ou revisado da parte simples)
    # entra na frase; núcleo sem nome pt é capturado do próprio texto (ver names_pt.escolhe_frase).
    nomes_pt_do_nucleo: dict[str, set[str]] = defaultdict(set)
    for r in linhas:
        if r["nome_pt"] and (r["origem"] == "revisado" or (r["origem"] == "auto" and r["confianca"] == "alta")):
            nomes_pt_do_nucleo[r["nome_en"]].add(r["nome_pt"])
    nucleo_pt = {k: next(iter(v)) for k, v in nomes_pt_do_nucleo.items() if len(v) == 1}

    grupos_c: dict[str, dict] = {}
    for cid, comp in comp_ents.items():
        g = grupos_c.setdefault(comp.base, {"comp": comp, "cids": [], "versos": set()})
        g["cids"].append(cid)
        g["versos"] |= refs[cid]
    comp_sem_versos = 0
    for base, g in grupos_c.items():
        comp = g["comp"]
        V = sorted(g["versos"])
        if not any(v in verses for v in V):
            comp_sem_versos += len(g["cids"])
            continue
        fr = escolhe_frase(glossario[comp.cabeca], comp.nucleo, nucleo_pt.get(comp.nucleo), V, verses)
        chave = (base, fr.candidato)
        for cid in g["cids"]:
            chave_entidade[cid] = chave
        if chave in chaves_preservadas:
            continue
        linhas.append({
            "nome_en": base,
            "candidato": fr.candidato,
            "nome_pt": fr.candidato[:1].upper() + fr.candidato[1:] if fr.achados else fr.candidato,
            "origem": "auto",
            "confianca": fr.confianca,
            "entidades": str(len(g["cids"])),
            "versos": str(fr.versos),
            "cobertura": f"{fr.achados / fr.versos:.2f}" if fr.versos else "0.00",
            "alternativa": fr.alternativa or "",
        })
    escrever_tsv(linhas)

    # Staging: só linhas com nome pt utilizável. Revisado sem nome pt não conta.
    utilizaveis = {
        (r["nome_en"], r["candidato"]): r["nome_pt"]
        for r in linhas
        if r["nome_pt"] and (r["origem"] == "revisado" or (r["origem"] == "auto" and r["confianca"] == "alta"))
    }
    usados: set[tuple[str, str]] = set()
    cites_gravados = eventos = 0
    meta = json.loads((STAGING / "blivre" / "source.json").read_text(encoding="utf-8"))
    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="entity",
            title="Nomes próprios em português (derivados da Bíblia Livre)",
            lang="pt",
            license=meta["license"],
            license_url=meta["license_url"],
            url=meta["url"],
            version="derivado de blivre (porbr2018); pipeline/ingest/nomes_pt.py",
            attribution=meta["attribution"] + " Nomes próprios em português derivados da Bíblia Livre por "
                         "alinhamento de versículos (ver notes).",
            notes="Derivado: para cada nome inglês de theographic, stepbible-tipnr e openbible-geo, o nome pt é a "
                  "palavra da Bíblia Livre que aparece nos versículos da própria entidade e se parece com o nome. "
                  "Sem IA e sem tradução automática. Revisado em pipeline/ingest/corrections/nomes-pt.tsv. Compostos "
                  "(Mount Sinai, Valley of Elah) entram só com a frase que aparece no texto da própria entidade, com "
                  "cabeça do glossário pt e núcleo pt; sem frase achada, ficam com o nome inglês. Sufixo numérico "
                  "mantido (Achzib 2); parênteses descartados.",
        )
        for cid, e in entidades.items():
            if cid in comp_ents:
                sufixo = comp_ents[cid].sufixo
            else:
                partes = split_name(e["name"])
                if partes is None:
                    continue
                sufixo = partes[1]
            if e["type"] == "event":
                eventos += 1
                continue
            chave = chave_entidade.get(cid)
            pt = utilizaveis.get(chave) if chave else None
            if not pt:
                continue
            w.row("entity_name", cite_id=cid, lang="pt", name=pt + sufixo)
            usados.add(chave)
            cites_gravados += 1

    # Resumo.
    auto = [r for r in linhas if r["origem"] == "auto"]
    print(f"\nEntidades: {len(entidades)} (compostos ou não próprios: {compostos}; "
          f"sem versículo na Bíblia Livre: {sem_versos}; eventos com linha descartados: {eventos})")
    comp_linhas = [r for r in linhas if r["origem"] == "auto" and r["nome_en"] in grupos_c]
    print(f"Compostos: entidades decompostas {len(comp_ents)} em {len(grupos_c)} nomes; "
          f"fora (descritivo ou cabeça fora do glossário): {fora_comp} entidades; "
          f"sem versículo na Bíblia Livre: {comp_sem_versos} entidades")
    print("  linhas de composto por confiança: " + ", ".join(
        f"{c}={sum(1 for r in comp_linhas if r['confianca'] == c)}" for c in ("alta", "media", "baixa")))
    print(f"Linhas do TSV (nome_en, candidato): {len(linhas)}. Auto por confiança: " + ", ".join(
        f"{c}={sum(1 for r in auto if r['confianca'] == c)}" for c in ("alta", "media", "baixa")))
    print(f"  alta pela segunda via (grafia diferente): {via2}; gentílicos -ite/-ites rebaixados a baixa: "
          f"{sum(1 for r in auto if gentilico(r['nome_en']))}")
    print(f"Revisados: {sum(1 for r in linhas if r['origem'] == 'revisado')}, "
          f"sem (não usar pt): {sum(1 for r in linhas if r['origem'] == 'sem')}, "
          f"revisados sem nome pt: {sum(1 for r in linhas if r['origem'] == 'revisado' and not r['nome_pt'])}")
    print(f"Linhas usadas: {len(usados)} | entidades com entity_name: {cites_gravados}")
    print(f"TSV: {TSV}")


if __name__ == "__main__":
    main()
