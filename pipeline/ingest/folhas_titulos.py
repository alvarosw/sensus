"""Folhas de tradução dos títulos de eventos numa língua. As regras puras estão em sensus/titulos_pt.py.

Gera, por lote, tmp/traducao/<xx>/titulos-NN.tsv (fora do git) com os eventos de origem=rascunho do TSV da língua.
Colunas: event_id, cite_id, titulo_en, titulo_pt (referência em português; vazio se não há), participantes
(`Nome em inglês=nome na língua; ...`; o nome na língua vem de data/staging/sensus-nomes-<xx>/entity_name.jsonl
quando esse arquivo existe, senão fica vazio), ref (versículo principal), titulo_<xx> (a preencher) e nota.

Depois de preenchida, a folha vai para aplica_titulos.py. Não sobrescreve folhas existentes (podem ter trabalho de
tradução); para refazer, apague a pasta à mão.

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/folhas_titulos.py --lang es [--lote 100]
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus import correcoes  # noqa: E402
from sensus import staging as stg  # noqa: E402
from sensus.linguas import LINGUAS  # noqa: E402
from sensus.titulos_pt import colunas_folha, eventos_da_fonte, formata_participantes, ler_tsv  # noqa: E402


def nomes_da_lingua(lang: str) -> dict[str, str]:
    """cite_id -> nome na língua, das entidades já prontas em sensus-nomes-<xx> (vazio se a fonte não existe)."""
    arq = stg.STAGING / f"sensus-nomes-{lang}" / "entity_name.jsonl"
    if not arq.exists():
        return {}
    nomes = {}
    for linha in arq.read_text(encoding="utf-8").splitlines():
        if linha.strip():
            r = json.loads(linha)
            nomes[r["cite_id"]] = r["name"]
    return nomes


def _campo(valor: str) -> str:
    return str(valor).replace("\t", " ").replace("\n", " ").strip()


def main(lang: str, lote: int = 100) -> None:
    if lang not in LINGUAS:
        raise SystemExit(f"língua fora de LINGUAS: {lang!r}")
    tsv = correcoes.caminho(lang, "titulos-eventos")
    if not tsv.exists():
        raise SystemExit(f"{tsv} não existe; rode antes: python3 pipeline/ingest/titulos.py --lang {lang}")
    pasta = ROOT / "tmp" / "traducao" / lang
    if pasta.exists() and any(pasta.glob("titulos-*.tsv")):
        raise SystemExit(f"já há folhas em {pasta}; apague a pasta antes de gerar de novo")

    registros = [
        json.loads(l) for l in (stg.STAGING / "theographic" / "entity.jsonl").read_text(encoding="utf-8").splitlines()
        if l.strip()
    ]
    eventos = eventos_da_fonte(registros)
    rascunhos = {r["cite_id"] for r in ler_tsv(tsv.read_text(encoding="utf-8"), lang) if r["origem"] == "rascunho"}
    pendentes = [e for e in eventos if e["cite_id"] in rascunhos]

    pt_tsv = correcoes.caminho("pt", "titulos-eventos")
    titulo_pt = {r["cite_id"]: r["titulo_pt"] for r in ler_tsv(pt_tsv.read_text(encoding="utf-8"), "pt")}
    nomes = nomes_da_lingua(lang)

    cols = colunas_folha(lang)
    pasta.mkdir(parents=True, exist_ok=True)
    sem_nome = 0
    for n, ini in enumerate(range(0, len(pendentes), lote), 1):
        corpo = ["\t".join(cols)]
        for e in pendentes[ini: ini + lote]:
            sem_nome += sum(1 for p in e["participantes"] if p["cite_id"] not in nomes)
            valores = {
                "event_id": str(e["event_id"]),
                "cite_id": e["cite_id"],
                "titulo_en": e["titulo_en"],
                "titulo_pt": titulo_pt.get(e["cite_id"], ""),
                "participantes": formata_participantes(e["participantes"], nomes),
                "ref": e["ref"],
                f"titulo_{lang}": "",
                "nota": "",
            }
            corpo.append("\t".join(_campo(valores[c]) for c in cols))
        arq = pasta / f"titulos-{n:02d}.tsv"
        arq.write_text("\n".join(corpo) + "\n", encoding="utf-8")
        print(f"  {arq} ({min(lote, len(pendentes) - ini)} eventos)")

    print(f"\nRascunhos para traduzir: {len(pendentes)} de {len(eventos)} eventos")
    print(f"Participantes sem nome em {lang} (campo vazio na folha): {sem_nome}")
    print(f"Pasta: {pasta}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--lang", required=True, choices=LINGUAS)
    parser.add_argument("--lote", type=int, default=100)
    args = parser.parse_args()
    main(args.lang, args.lote)
