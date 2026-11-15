"""Aplica os títulos traduzidos (folhas preenchidas por folhas_titulos.py) ao TSV de correções da língua.

Cada linha da folha com titulo_<xx> preenchido vira origem=revisado, com nota "rev. IA" (ou a nota que já estava no
TSV, e a nota da folha, se houver). Linhas com o título em branco ficam como estão. Se um participante tem nome na
língua e esse nome não aparece no título, sai um AVISO (não é erro: quem revisa decide). Um cite_id que não está no
TSV é erro, para não gravar título em evento que não existe.

Depois: python3 pipeline/ingest/titulos.py --lang <xx> para regerar o staging sensus-titulos-<xx>.

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/aplica_titulos.py --lang es tmp/traducao/es/titulos-01.tsv [...]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sensus import correcoes  # noqa: E402
from sensus.linguas import LINGUAS  # noqa: E402
from sensus.titulos_pt import faltando_no_titulo, ler_folha, ler_participantes, ler_tsv  # noqa: E402
from titulos import grava_tsv  # noqa: E402


def main(lang: str, folhas: list[Path]) -> None:
    if lang not in LINGUAS:
        raise SystemExit(f"língua fora de LINGUAS: {lang!r}")
    tsv = correcoes.caminho(lang, "titulos-eventos")
    if not tsv.exists():
        raise SystemExit(f"{tsv} não existe; rode antes: python3 pipeline/ingest/titulos.py --lang {lang}")
    linhas = ler_tsv(tsv.read_text(encoding="utf-8"), lang)
    por_cite = {r["cite_id"]: r for r in linhas}
    t = f"titulo_{lang}"

    aplicadas, em_branco, avisos = 0, 0, []
    for folha in folhas:
        for r in ler_folha(folha.read_text(encoding="utf-8"), lang):
            titulo = r[t].strip()
            if not titulo:
                em_branco += 1
                continue
            if r["cite_id"] not in por_cite:
                raise SystemExit(f"{folha}: cite_id {r['cite_id']} não está no TSV de {lang}; "
                                 f"rode titulos.py --lang {lang} e confira a folha")
            faltam = faltando_no_titulo(titulo, ler_participantes(r["participantes"]))
            if faltam:
                avisos.append(f"evento {r['event_id']} {titulo!r}: nome de participante ausente no título: "
                              + ", ".join(faltam))
            linha = por_cite[r["cite_id"]]
            linha[t] = titulo
            linha["origem"] = "revisado"
            nota = linha["nota"].strip() or "rev. IA"
            extra = r["nota"].strip()
            if extra and extra not in nota:
                nota = f"{nota}; {extra}"
            linha["nota"] = nota
            aplicadas += 1

    grava_tsv(lang, linhas, tsv)
    print(f"Aplicadas: {aplicadas} | folhas sem título (não tocadas): {em_branco}")
    for aviso in avisos:
        print(f"AVISO {aviso}")
    print(f"TSV: {tsv}")
    print(f"Próximo passo: python3 pipeline/ingest/titulos.py --lang {lang}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--lang", required=True, choices=LINGUAS)
    parser.add_argument("folhas", nargs="+", type=Path)
    args = parser.parse_args()
    main(args.lang, args.folhas)
