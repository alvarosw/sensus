"""Ingestor: nomes próprios por língua (entity_name), derivados da Bíblia de referência da língua (sensus/linguas.py).

Mesmo método para todas as línguas: o candidato de cada entidade é a palavra (ou o nome marcado, em zh e ur) da
Bíblia da língua que aparece nos versículos da entidade e se parece com o nome inglês (sensus/names_pt.py), com o
perfil de escrita da língua (sensus/escritas.py). Os versículos vêm na numeração da KJV (sensus/alinhada.py).
Sem IA: linhas de confiança média/baixa, compostos e manuais são revisados depois por agentes (folhas_nomes.py,
aplica_nomes.py), com as respostas gravadas nos TSV da língua.

Entrada (staging, rodar depois dos ingestores): entity e entity_ref de theographic, stepbible-tipnr e
openbible-geo; a Bíblia da língua (data/staging/bibles/<id>, ou data/staging/blivre para pt) e kjv.

Saídas:
  a) pipeline/ingest/corrections/<xx>/nomes.tsv (pt: corrections/nomes-pt.tsv). Linhas origem=auto são recalculadas
     a cada execução; origem=revisado e origem=sem são preservadas (chave nome_en + candidato).
  b) data/staging/sensus-nomes-<xx>/ (entity_name): uma linha por entidade (não evento) cujo nome na língua é
     utilizável (origem revisado com nome, ou auto com confianca alta), mais os nomes manuais revisados.

O português é o caso de origem: seus arquivos são os legados (sensus/correcoes.py) e as saídas são as de antes.
Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/nomes.py --lang es
    python3 pipeline/ingest/nomes_pt.py      (invólucro do pt)
"""

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))

from sensus.alinhada import versiculos_kjv  # noqa: E402
from sensus.correcoes import caminho  # noqa: E402
from sensus.escritas import PERFIS  # noqa: E402
from sensus.linguas import BIBLIA_NOMES, LINGUAS, NOME_PT  # noqa: E402
from sensus.names_pt import (  # noqa: E402
    Composto, avalia, choose, decompoe, escolhe_frase, ler_nomes_manuais, split_name,
)
from sensus.staging import STAGING, StagingWriter  # noqa: E402

ENTITY_SOURCES = ["theographic", "stepbible-tipnr", "openbible-geo"]
ORIGENS = ("auto", "revisado", "sem")
ORDEM_CONFIANCA = {"baixa": 0, "media": 1, "alta": 2}

# Cabeçalho do TSV do pt: idêntico ao de antes da divisão por língua (o git diff do pt tem de ficar vazio).
CABECALHO_PT = [
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


def colunas(lang: str) -> list[str]:
    return ["nome_en", "candidato", f"nome_{lang}", "origem", "confianca", "entidades", "versos", "cobertura",
            "alternativa"]


def _cabecalho(lang: str) -> list[str]:
    if lang == "pt":
        return CABECALHO_PT
    bid = BIBLIA_NOMES[lang]
    return [
        f"# Nomes próprios em {NOME_PT[lang]}: nome em inglês (nome-base, sem sufixo numérico) -> nome {lang} da "
        f"Bíblia {bid}.",
        f"# Gerado por pipeline/ingest/nomes.py --lang {lang}. Uma linha por (nome_en, candidato). Colunas:",
        "#   nome_en      nome-base inglês das fontes de entidades",
        "#   candidato    escolha automática na Bíblia da língua; identifica a linha (não editar)",
        f"#   nome_{lang}      valor final, que o revisor edita (começa igual a candidato)",
        "#   origem       auto (calculado) | revisado (decisão humana) | sem (não usar este nome)",
        "#   confianca    alta | media | baixa (limiares do perfil em pipeline/sensus/escritas.py)",
        "#   entidades    quantas entidades caem nesta linha",
        "#   versos       versículos do nome que existem na Bíblia da língua",
        "#   cobertura    fração desses versículos em que o candidato aparece",
        "#   alternativa  segundo colocado, para conferir",
        "# Compostos: cabeça do glossário + núcleo (glossario-compostos.tsv); o candidato é a frase como está na",
        "# Bíblia da língua. Não achada: candidato = forma do glossário + núcleo, confianca baixa.",
        "# Revisão: comece pelas linhas de confianca baixa e media. Linhas revisado e sem não são recalculadas.",
    ]


def jsonl(path: Path):
    with open(path, encoding="utf-8") as fh:
        for linha in fh:
            if linha.strip():
                yield json.loads(linha)


def ler_glossario(lang: str) -> dict[str, tuple[str, ...]]:
    """Cabeças inglesas dos compostos -> formas da língua (corrections/<xx>/glossario-compostos.tsv). Vazio se
    o arquivo ainda não existe (a língua então não tem compostos até o agente de revisão preencher)."""
    arq = caminho(lang, "glossario-compostos")
    if not arq.exists():
        return {}
    glossario = {}
    for linha in arq.read_text(encoding="utf-8").splitlines():
        if not linha.strip() or linha.startswith("#") or linha.startswith("cabeca\t"):
            continue
        cabeca, formas = linha.split("\t")
        glossario[cabeca] = tuple(f for f in formas.split("|") if f)
    return glossario


def ler_tsv(tsv: Path, lang: str) -> list[dict]:
    """Linhas do TSV de revisão (sem comentários e cabeçalho). Vazio se não existe. Cabeçalho diferente ou origem
    fora de auto/revisado/sem: erro, para o regenerador não regravar o arquivo perdendo revisões."""
    if not tsv.exists():
        return []
    cols = colunas(lang)
    # número da linha física junto, para a mensagem de erro
    linhas = [
        (n, l) for n, l in enumerate(tsv.read_text(encoding="utf-8").splitlines(), 1)
        if l.strip() and not l.startswith("#")
    ]
    if not linhas:
        return []
    (_, cabecalho), *corpo = linhas
    if cabecalho.split("\t") != cols:
        raise ValueError(f"{tsv.name}: cabeçalho difere do esperado {cols}: {cabecalho!r}")
    rows = []
    for n, l in corpo:
        campos = (l.split("\t") + [""] * len(cols))[: len(cols)]
        r = dict(zip(cols, campos))
        origem = r["origem"]
        r["origem"] = origem.strip().lower()
        if r["origem"] not in ORIGENS:
            raise ValueError(f"{tsv.name}, linha {n}: origem inválida {origem!r} (use auto, revisado ou sem)")
        rows.append(r)
    return rows


def escrever_tsv(tsv: Path, lang: str, linhas: list[dict]) -> None:
    cols = colunas(lang)
    linhas.sort(key=lambda r: (ORDEM_CONFIANCA.get(r["confianca"], 3), r["nome_en"], r["candidato"]))
    corpo = ["\t".join(cols)] + ["\t".join(r[c] for c in cols) for r in linhas]
    tsv.parent.mkdir(parents=True, exist_ok=True)
    tsv.write_text("\n".join(_cabecalho(lang) + corpo) + "\n", encoding="utf-8")


def _meta_biblia(bid: str) -> dict:
    """source.json da Bíblia de referência (bibles/<id> ou o banco principal, como blivre)."""
    for pasta in (STAGING / "bibles" / bid, STAGING / bid):
        if (pasta / "source.json").exists():
            return json.loads((pasta / "source.json").read_text(encoding="utf-8"))
    raise FileNotFoundError(f"source.json da Bíblia {bid} ausente no staging")


def _fonte(lang: str, bid: str, meta: dict) -> dict:
    """Metadados da fonte sensus-nomes-<xx>. O texto do pt é o de antes da divisão por língua (não mudar)."""
    if lang == "pt":
        return dict(
            title="Nomes próprios em português (derivados da Bíblia Livre)",
            version="derivado de blivre (porbr2018); pipeline/ingest/nomes_pt.py",
            attribution=meta["attribution"] + " Nomes próprios em português derivados da Bíblia Livre por "
                        "alinhamento de versículos (ver notes).",
            notes="Derivado: para cada nome inglês de theographic, stepbible-tipnr e openbible-geo, o nome pt é a "
                  "palavra da Bíblia Livre que aparece nos versículos da própria entidade e se parece com o nome. "
                  "Escolha automática sem IA; as linhas de confiança média/baixa foram revisadas por agentes de IA "
                  "conferindo os versículos da Bíblia Livre (notas em corrections/nomes-pt-revisao.tsv). Revisado em "
                  "pipeline/ingest/corrections/nomes-pt.tsv. Compostos "
                  "(Mount Sinai, Valley of Elah) entram só com a frase que aparece no texto da própria entidade, com "
                  "cabeça do glossário pt e núcleo pt; sem frase achada, ficam com o nome inglês. Sufixo numérico "
                  "mantido (Achzib 2); parênteses descartados.",
        )
    nome = NOME_PT[lang]
    return dict(
        title=f"Nomes próprios em {nome} (derivados da Bíblia {bid})",
        version=f"derivado de {bid} ({meta['version']}); pipeline/ingest/nomes.py --lang {lang}",
        attribution=f"{meta['attribution']} Nomes próprios em {nome} derivados da Bíblia {bid} por alinhamento de "
                    f"versículos (ver notes).",
        notes=f"Derivado: para cada nome inglês de theographic, stepbible-tipnr e openbible-geo, o nome em {nome} é "
              f"a palavra (ou o nome marcado) da Bíblia {bid} que aparece nos versículos da própria entidade e se "
              f"parece com o nome (perfil de escrita em pipeline/sensus/escritas.py). Escolha automática sem IA; "
              f"linhas de confiança média/baixa, compostos e manuais revisados com auxílio de IA e revisados por "
              f"amostragem (corrections/{lang}/nomes.tsv). Compostos entram só com a frase que aparece no texto da "
              f"própria entidade; sem frase achada, ficam com o nome inglês. Sufixo numérico mantido.",
    )


def _resumo(lang: str, cats: Counter, gravados: set[str], entidades_com_nome_pt: set[str]) -> str:
    pt = ""
    if entidades_com_nome_pt:
        comum = len(gravados & entidades_com_nome_pt)
        pt = f"; paridade com pt: {comum}/{len(entidades_com_nome_pt)} = {100 * comum / len(entidades_com_nome_pt):.1f}%"
    return (f"{lang}: alta={cats['alta']} media={cats['media']} baixa={cats['baixa']} "
            f"revisado={cats['revisado']} manual={cats['manual']} sem={cats['sem']} "
            f"| gravados={len(gravados)}{pt}")


def main(lang: str) -> dict:
    """Gera o TSV e o staging de nomes da língua. Devolve o resumo (contagens por confiança e paridade com o pt)."""
    if lang not in PERFIS:
        raise ValueError(f"língua sem perfil: {lang!r}")
    bid = BIBLIA_NOMES[lang]
    perfil = PERFIS[lang]
    col = f"nome_{lang}"
    tsv = caminho(lang, "nomes")

    verses, marcados = versiculos_kjv(bid)
    # Candidatos por versículo: palavras do texto, ou nomes marcados na Bíblia (zh \pn, ur ؔ).
    if perfil.usa_marcados:
        brutos = {v: {perfil.saida(n) for n in marcados.get(v, [])} for v in verses}
    else:
        brutos = {v: {perfil.saida(c) for c in perfil.candidatos(t)} for v, t in verses.items()}
    vocabulario = frozenset(c for s in brutos.values() for c in s)
    vc = {v: {perfil.chave(c, vocabulario) for c in s} for v, s in brutos.items()}
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
    preferido = {b: choose(b, V, vc, df, perfil).nome for b, V in versos_base.items()}

    grupos: dict[tuple[str, str], dict] = {}
    chave_entidade: dict[str, tuple[str, str]] = {}
    sem_versos = 0
    # Compostos ('Mount Sinai'): decompostos aqui, frases escolhidas depois da parte simples (precisam dos nomes).
    glossario = ler_glossario(lang)
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
        esc = choose(base, refs[cid], vc, df, perfil)
        if esc.nome is None:
            sem_versos += 1
            continue
        pref = preferido.get(base)
        V = [v for v in refs[cid] if v in vc]
        if pref and pref != esc.nome and V and sum(1 for v in V if pref in vc[v]) * 2 >= len(V):
            esc = avalia(base, pref, refs[cid], vc, df, esc.nome, perfil)
        chave = (base, esc.nome)
        chave_entidade[cid] = chave
        g = grupos.setdefault(chave, {"cids": [], "versos": set(), "alts": Counter()})
        g["cids"].append(cid)
        g["versos"] |= refs[cid]
        if esc.alternativa:
            g["alts"][esc.alternativa] += 1

    # TSV: preserva revisado e sem (pela chave); recalcula auto.
    existentes = ler_tsv(tsv, lang)
    preservadas = [r for r in existentes if r["origem"] in ("revisado", "sem")]
    chaves_preservadas = {(r["nome_en"], r["candidato"]) for r in preservadas}
    linhas = list(preservadas)
    for (base, c), g in grupos.items():
        if (base, c) in chaves_preservadas:
            continue
        alt = next((a for a, _ in g["alts"].most_common() if a != c), None)
        e = avalia(base, c, g["versos"], vc, df, alt, perfil)
        linhas.append({
            "nome_en": base,
            "candidato": c,
            col: c,
            "origem": "auto",
            "confianca": e.confianca,
            "entidades": str(len(g["cids"])),
            "versos": str(e.versos),
            "cobertura": f"{e.cobertura:.2f}",
            "alternativa": alt or "",
        })
    # Compostos: uma linha por (nome-base, frase). Núcleo com nome na língua (linhas alta ou revisado da parte
    # simples) entra na frase; núcleo sem nome é capturado do próprio texto (ver names_pt.escolhe_frase).
    nomes_do_nucleo: dict[str, set[str]] = defaultdict(set)
    for r in linhas:
        if r[col] and (r["origem"] == "revisado" or (r["origem"] == "auto" and r["confianca"] == "alta")):
            nomes_do_nucleo[r["nome_en"]].add(r[col])
    nucleo_pt = {k: next(iter(v)) for k, v in nomes_do_nucleo.items() if len(v) == 1}

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
        fr = escolhe_frase(glossario[comp.cabeca], comp.nucleo, nucleo_pt.get(comp.nucleo), V, verses, perfil)
        chave = (base, fr.candidato)
        for cid in g["cids"]:
            chave_entidade[cid] = chave
        if chave in chaves_preservadas:
            continue
        nome = fr.candidato[:1].upper() + fr.candidato[1:] if fr.achados else fr.candidato
        linhas.append({
            "nome_en": base,
            "candidato": fr.candidato,
            col: nome,
            "origem": "auto",
            "confianca": fr.confianca,
            "entidades": str(len(g["cids"])),
            "versos": str(fr.versos),
            "cobertura": f"{fr.achados / fr.versos:.2f}" if fr.versos else "0.00",
            "alternativa": fr.alternativa or "",
        })
    escrever_tsv(tsv, lang, linhas)

    # Staging: só linhas com nome utilizável. Revisado sem nome não conta.
    utilizaveis = {
        (r["nome_en"], r["candidato"]): r[col]
        for r in linhas
        if r[col] and (r["origem"] == "revisado" or (r["origem"] == "auto" and r["confianca"] == "alta"))
    }
    por_chave = {(r["nome_en"], r["candidato"]): r for r in linhas}
    meta = _meta_biblia(bid)
    manuais_path = caminho(lang, "nomes-manuais")
    manuais = ler_nomes_manuais(manuais_path.read_text(encoding="utf-8"), lang) if manuais_path.exists() else {}
    manuais_gravados = 0
    cats: Counter = Counter()
    gravados: set[str] = set()
    with StagingWriter(f"sensus-nomes-{lang}") as w:
        fonte = _fonte(lang, bid, meta)
        w.source(
            kind="entity",
            lang=lang,
            license=meta["license"],
            license_url=meta["license_url"],
            url=meta["url"],
            **fonte,
        )
        for cid, e in entidades.items():
            # Sufixo: compostos pelo próprio decompõe; simples pelo split_name. Descritivo sem sufixo (None).
            if cid in comp_ents:
                sufixo = comp_ents[cid].sufixo
            else:
                partes = split_name(e["name"])
                sufixo = partes[1] if partes is not None else None
            if e["type"] == "event":
                continue
            chave = chave_entidade.get(cid)
            pt_nome = utilizaveis.get(chave) if chave and sufixo is not None else None
            if pt_nome:
                w.row("entity_name", cite_id=cid, lang=lang, name=pt_nome + sufixo)
                gravados.add(cid)
                cats["revisado" if por_chave[chave]["origem"] == "revisado" else "alta"] += 1
                continue
            # Sem nome pelo fluxo normal: nome manual revisado (nome_en + tipo), com o nome completo.
            manual = manuais.get((e["name"], e["type"]))
            if manual and manual["origem"] == "revisado" and manual[col].strip():
                w.row("entity_name", cite_id=cid, lang=lang, name=manual[col].strip())
                gravados.add(cid)
                manuais_gravados += 1
                cats["manual"] += 1
                continue
            if chave is None:
                cats["sem"] += 1
                continue
            linha = por_chave.get(chave)
            if linha is None or linha["origem"] != "auto":
                cats["sem"] += 1  # sem linha, origem sem, ou revisado sem nome: não usar
            else:
                cats[linha["confianca"]] += 1

    # Paridade: entidades com nome pt (staging do pt) que ganham nome nesta língua.
    pt_path = STAGING / "sensus-nomes-pt" / "entity_name.jsonl"
    com_pt = {r["cite_id"] for r in jsonl(pt_path)} if (lang != "pt" and pt_path.exists()) else set()
    resumo_txt = _resumo(lang, cats, gravados, com_pt)
    print(f"[sensus-nomes-{lang}] {resumo_txt}")
    print(f"  entidades: {len(entidades)} (compostos ou não próprios: {compostos}; sem versículo: {sem_versos}; "
          f"compostos sem versículo: {comp_sem_versos}); linhas do TSV: {len(linhas)}")
    print(f"  manuais revisados gravados: {manuais_gravados} de {len(manuais)} linhas; TSV: {tsv}")
    return {"lang": lang, "cats": dict(cats), "gravados": len(gravados), "paridade": len(gravados & com_pt),
            "pt": len(com_pt)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--lang", required=True, choices=["pt", *LINGUAS])
    main(ap.parse_args().lang)
