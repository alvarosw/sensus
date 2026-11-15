"""Ingestor: títulos dos eventos por língua (entity_name, fonte sensus-titulos-<xx>). Títulos escritos e revisados por
agentes de IA (nota "rev. IA" no TSV); sem tradução automática no aparelho. As regras puras estão em sensus/titulos_pt.py.

Entrada (staging, rodar depois de theographic): eventos de data/staging/theographic/entity.jsonl.

Saídas, por língua:
  a) pipeline/ingest/corrections/titulos-eventos.tsv (pt: titulos-eventos-pt.tsv, legado; es: corrections/es/...),
     versionado, para revisão. Os rascunhos ficam ali e nenhum deles vai para o banco.
  b) data/staging/sensus-titulos-<xx>/ (entity_name): uma linha por evento com origem=revisado e título preenchido.

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/titulos.py --lang es
    python3 pipeline/ingest/titulos_pt.py      (igual a --lang pt)
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus import correcoes  # noqa: E402
from sensus import staging as stg  # noqa: E402
from sensus.linguas import LINGUAS, NOME_PT  # noqa: E402
from sensus.titulos_pt import escolher_linhas, escrever_tsv, eventos_da_fonte, ler_tsv, mesclar  # noqa: E402

RÓTULO = {"pt": "pt-BR"}  # como o cabeçalho do TSV chama a língua; as outras usam o nome


def fonte_id(lang: str) -> str:
    return f"sensus-titulos-{lang}"


def cabecalho(lang: str, script: str) -> list[str]:
    """Comentários do TSV. Para pt, o texto é o de sempre (o TSV do português não pode mudar sem motivo)."""
    nome = NOME_PT[lang]
    rotulo = RÓTULO.get(lang, nome)
    return [
        f"# Títulos dos eventos em {nome}: título em inglês da Theographic -> título {rotulo}. Gerado por",
        f"# {script}. Uma linha por evento. Colunas:",
        "#   event_id     eventID da Theographic (identifica o evento na fonte)",
        "#   cite_id      ent:theographic:<id>; chave que a regeneração usa",
        "#   titulo_en    título na fonte (atualizado a cada execução)",
        f"#   titulo_{lang}    título em {nome}; rascunho até a revisão",
        "#   origem       rascunho (sugestão não revisada, NÃO vai para o banco) | revisado (vai para o banco) |",
        f"#                sem (não usar título {lang}; o app mostra o inglês)",
        "#   nota         observação para o revisor (ex.: erro de grafia na fonte, nome com dúvida)",
        f"# rascunho = sugestão não revisada. Para aprovar: confira titulo_{lang} ({rotulo}, curto, estilo de título), "
        "edite se",
        f"# preciso e marque origem=revisado. Ao regenerar, titulo_{lang}, origem e nota são preservados; evento novo "
        "entra",
        f"# como rascunho com titulo_{lang} vazio; evento que sumiu da fonte fica no fim do arquivo, fora do banco, e o",
        "# resumo do ingestor avisa (apague a linha à mão quando confirmar que ela não serve).",
    ]


def script_de(lang: str) -> str:
    return "pipeline/ingest/titulos_pt.py" if lang == "pt" else f"pipeline/ingest/titulos.py --lang {lang}"


def grava_tsv(lang: str, linhas: list[dict], caminho_tsv: Path) -> None:
    """Regrava o TSV de correções da língua, com os comentários por cima."""
    caminho_tsv.parent.mkdir(parents=True, exist_ok=True)
    caminho_tsv.write_text("\n".join(cabecalho(lang, script_de(lang))) + "\n" + escrever_tsv(linhas, lang),
                           encoding="utf-8")


def main(lang: str = "pt") -> None:
    tsv = correcoes.caminho(lang, "titulos-eventos")  # levanta erro para língua fora de pt/LINGUAS
    registros = [
        json.loads(l) for l in (stg.STAGING / "theographic" / "entity.jsonl").read_text(encoding="utf-8").splitlines()
        if l.strip()
    ]
    eventos = eventos_da_fonte(registros)
    existentes = ler_tsv(tsv.read_text(encoding="utf-8"), lang) if tsv.exists() else []
    r = mesclar(eventos, existentes, lang)
    grava_tsv(lang, r["linhas"], tsv)

    atuais = {e["cite_id"] for e in eventos}
    escolhidas = escolher_linhas(r["linhas"], atuais, lang)
    meta = json.loads((stg.STAGING / "theographic" / "source.json").read_text(encoding="utf-8"))
    nome = NOME_PT[lang]
    if lang == "pt":
        titulo_fonte = "Títulos de eventos em português (traduzidos e revisados pelo projeto Sensus)"
        notas = ("Derivado: título em português de cada evento da Theographic (campo title, em inglês). Os títulos "
                 "foram escritos e revisados por agentes de IA (conferindo os versículos da Bíblia Livre e pesquisando em caso de "
                 "dúvida; nota 'rev. IA' em pipeline/ingest/corrections/titulos-eventos-pt.tsv); "
                 "só os de origem revisado entram aqui. Nomes próprios vêm da Bíblia Livre (ver sensus-nomes-pt) ou dos "
                 "participantes do evento. Sem tradução automática no aparelho. Share-alike: como a "
                 "Theographic, CC BY-SA 4.0.")
    else:
        titulo_fonte = f"Títulos de eventos em {nome} (traduzidos e revisados pelo projeto Sensus)"
        notas = (f"Derivado: título em {nome} de cada evento da Theographic (campo title, em inglês). Os títulos foram "
                 "escritos e revisados por agentes de IA a partir do inglês, usando os nomes próprios da língua "
                 "(nota 'rev. IA' no TSV de correções da língua); "
                 "só os de origem revisado entram aqui. Sem tradução automática no aparelho. Share-alike: como a "
                 "Theographic, CC BY-SA 4.0.")
    with stg.StagingWriter(fonte_id(lang)) as w:
        w.source(
            kind="entity",
            title=titulo_fonte,
            lang=lang,
            license=meta["license"],
            license_url=meta["license_url"],
            url=meta["url"],
            version=f"derivado de theographic ({meta['version']}); {script_de(lang)}",
            attribution=meta["attribution"] + " Títulos traduzidos e revisados pelo projeto Sensus.",
            notes=notas,
        )
        for cite_id, titulo in escolhidas:
            w.row("entity_name", cite_id=cite_id, lang=lang, name=titulo)

    por_origem = {o: sum(1 for x in r["linhas"] if x["origem"] == o) for o in ("rascunho", "revisado", "sem")}
    t = f"titulo_{lang}"
    sem_titulo = sum(1 for x in r["linhas"] if x["origem"] == "rascunho" and not x[t].strip())
    revisados_sem_titulo = [x["event_id"] for x in r["linhas"] if x["origem"] == "revisado" and not x[t].strip()]
    print(f"\nEventos na fonte: {len(eventos)} | linhas do TSV: {len(r['linhas'])}")
    print("Por origem: " + ", ".join(f"{o}={n}" for o, n in por_origem.items())
          + f" (rascunho sem título: {sem_titulo})")
    print(f"Novos (entram como rascunho, sem título): {len(r['novos'])} {r['novos'][:20]}")
    print(f"Título en alterado na fonte (reler o título): {len(r['alterados'])} {r['alterados'][:20]}")
    if r["sumidos"]:
        print(f"Sumidos da fonte (fora do banco; apague do TSV quando confirmar): {len(r['sumidos'])} "
              + str([f"{ev}:{cid}" for ev, cid in r["sumidos"]][:20]))
    if revisados_sem_titulo:
        print(f"revisado sem titulo_{lang} (não entram): {revisados_sem_titulo}")
    print(f"Entram no banco (entity_name, lang {lang}): {len(escolhidas)}")
    print(f"TSV: {tsv}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--lang", default="pt", choices=("pt",) + LINGUAS)
    main(parser.parse_args().lang)
