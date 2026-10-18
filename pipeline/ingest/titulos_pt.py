"""Ingestor: títulos dos eventos em português (entity_name, fonte sensus-titulos-pt). Sem IA e sem tradução automática
no aparelho. As regras puras estão em sensus/titulos_pt.py.

Entrada (staging, rodar depois de theographic): eventos de data/staging/theographic/entity.jsonl.

Saídas:
  a) pipeline/ingest/corrections/titulos-eventos-pt.tsv, versionado, para revisão humana. Os rascunhos ficam ali e
     nenhum deles vai para o banco.
  b) data/staging/sensus-titulos-pt/ (entity_name): uma linha por evento com origem=revisado e titulo_pt preenchido.

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/titulos_pt.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import STAGING, StagingWriter  # noqa: E402
from sensus.titulos_pt import escolher_linhas, escrever_tsv, eventos_da_fonte, ler_tsv, mesclar  # noqa: E402

SOURCE_ID = "sensus-titulos-pt"
TSV = Path(__file__).resolve().parent / "corrections" / "titulos-eventos-pt.tsv"
CABECALHO = [
    "# Títulos dos eventos em português: título em inglês da Theographic -> título pt-BR. Gerado por",
    "# pipeline/ingest/titulos_pt.py. Uma linha por evento. Colunas:",
    "#   event_id     eventID da Theographic (identifica o evento na fonte)",
    "#   cite_id      ent:theographic:<id>; chave que a regeneração usa",
    "#   titulo_en    título na fonte (atualizado a cada execução)",
    "#   titulo_pt    título em português; rascunho até a revisão",
    "#   origem       rascunho (sugestão não revisada, NÃO vai para o banco) | revisado (vai para o banco) |",
    "#                sem (não usar título pt; o app mostra o inglês)",
    "#   nota         observação para o revisor (ex.: erro de grafia na fonte, nome com dúvida)",
    "# rascunho = sugestão não revisada. Para aprovar: confira titulo_pt (pt-BR, curto, estilo de título), edite se",
    "# preciso e marque origem=revisado. Ao regenerar, titulo_pt, origem e nota são preservados; evento novo entra",
    "# como rascunho com titulo_pt vazio; evento que sumiu da fonte fica no fim do arquivo, fora do banco, e o",
    "# resumo do ingestor avisa (apague a linha à mão quando confirmar que ela não serve).",
]


def main() -> None:
    registros = [
        json.loads(l) for l in (STAGING / "theographic" / "entity.jsonl").read_text(encoding="utf-8").splitlines()
        if l.strip()
    ]
    eventos = eventos_da_fonte(registros)
    existentes = ler_tsv(TSV.read_text(encoding="utf-8")) if TSV.exists() else []
    r = mesclar(eventos, existentes)
    TSV.write_text("\n".join(CABECALHO) + "\n" + escrever_tsv(r["linhas"]), encoding="utf-8")

    atuais = {e["cite_id"] for e in eventos}
    escolhidas = escolher_linhas(r["linhas"], atuais)
    meta = json.loads((STAGING / "theographic" / "source.json").read_text(encoding="utf-8"))
    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="entity",
            title="Títulos de eventos em português (traduzidos e revisados pelo projeto Sensus)",
            lang="pt",
            license=meta["license"],
            license_url=meta["license_url"],
            url=meta["url"],
            version=f"derivado de theographic ({meta['version']}); pipeline/ingest/titulos_pt.py",
            attribution=meta["attribution"] + " Títulos traduzidos e revisados pelo projeto Sensus.",
            notes="Derivado: título em português de cada evento da Theographic (campo title, em inglês). Os títulos "
                  "são rascunhos do projeto, conferidos por pessoa em pipeline/ingest/corrections/titulos-eventos-pt.tsv; "
                  "só os de origem revisado entram aqui. Nomes próprios vêm da Bíblia Livre (ver sensus-nomes-pt) ou dos "
                  "participantes do evento. Sem IA e sem tradução automática no aparelho. Share-alike: como a "
                  "Theographic, CC BY-SA 4.0.",
        )
        for cite_id, titulo in escolhidas:
            w.row("entity_name", cite_id=cite_id, lang="pt", name=titulo)

    por_origem = {o: sum(1 for x in r["linhas"] if x["origem"] == o) for o in ("rascunho", "revisado", "sem")}
    sem_pt = sum(1 for x in r["linhas"] if x["origem"] == "rascunho" and not x["titulo_pt"].strip())
    revisados_sem_pt = [x["event_id"] for x in r["linhas"] if x["origem"] == "revisado" and not x["titulo_pt"].strip()]
    print(f"\nEventos na fonte: {len(eventos)} | linhas do TSV: {len(r['linhas'])}")
    print("Por origem: " + ", ".join(f"{o}={n}" for o, n in por_origem.items())
          + f" (rascunho sem título pt: {sem_pt})")
    print(f"Novos (entram como rascunho, sem título pt): {len(r['novos'])} {r['novos'][:20]}")
    print(f"Título en alterado na fonte (reler o pt): {len(r['alterados'])} {r['alterados'][:20]}")
    if r["sumidos"]:
        print(f"Sumidos da fonte (fora do banco; apague do TSV quando confirmar): {len(r['sumidos'])} "
              + str([f"{ev}:{cid}" for ev, cid in r["sumidos"]][:20]))
    if revisados_sem_pt:
        print(f"revisado sem titulo_pt (não entram): {revisados_sem_pt}")
    print(f"Entram no banco (entity_name, lang pt): {len(escolhidas)}")
    print(f"TSV: {TSV}")


if __name__ == "__main__":
    main()
