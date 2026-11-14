"""Aplica as respostas dos agentes de revisão de nomes (folhas de folhas_nomes.py) aos TSV da língua.

Cada resposta é um TSV UTF-8 com cabeçalho exato e uma linha por linha da folha:
  revisao / alta  -> nome_en, candidato, nome_<xx>, origem, nota   (atualiza corrections/<xx>/nomes.tsv)
  manuais / faltando -> nome_en, tipo, nome_<xx>, origem, nota     (atualiza corrections/<xx>/nomes-manuais.tsv)
origem é revisado (nome decidido) ou sem (não usar nome nesta língua). A nota começa com 'rev. IA:' e diz a
referência conferida. As notas também vão para corrections/<xx>/nomes-revisao.tsv.

Validação (erro com o número da linha, nada é gravado se alguma linha falha): cabeçalho exato, cinco colunas,
origem válida, nome NFC, sem tab, na escrita da língua (escrita_ok), revisado com nome, nota com 'rev. IA:' e
chave existente no TSV (revisao) ou sem repetição.

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/aplica_nomes.py --lang es tmp/traducao/es/nomes-revisao-01.resp.tsv
Depois, rodar pipeline/ingest/nomes.py --lang es para regenerar o staging.
"""

import argparse
import sys
import unicodedata
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import nomes as N  # noqa: E402
from sensus.correcoes import caminho  # noqa: E402
from sensus.escritas import escrita_ok  # noqa: E402
from sensus.linguas import LINGUAS  # noqa: E402

ORIGENS_RESPOSTA = ("revisado", "sem")
PREFIXO_NOTA = "rev. IA:"


def cabecalho_revisao(lang: str) -> list[str]:
    return ["nome_en", "candidato", f"nome_{lang}", "origem", "nota"]


def cabecalho_manual(lang: str) -> list[str]:
    return ["nome_en", "tipo", f"nome_{lang}", "origem", "nota"]


def valida_resposta(texto: str, lang: str) -> tuple[str, list[dict]]:
    """(tipo, linhas) da resposta: 'revisao' (chave nome_en + candidato) ou 'manual' (chave nome_en + tipo).

    ValueError com o número da linha para qualquer falha. Função pura.
    """
    col = f"nome_{lang}"
    linhas = [(n, l) for n, l in enumerate(texto.splitlines(), 1) if l.strip() and not l.startswith("#")]
    if not linhas:
        raise ValueError("resposta vazia")
    (_, cab), *corpo = linhas
    campos_cab = cab.split("\t")
    if campos_cab == cabecalho_revisao(lang):
        tipo, chave_col = "revisao", "candidato"
    elif campos_cab == cabecalho_manual(lang):
        tipo, chave_col = "manual", "tipo"
    else:
        raise ValueError(f"cabeçalho não reconhecido: {campos_cab}")
    cols = campos_cab
    out: list[dict] = []
    vistos: set[tuple[str, str]] = set()
    for n, l in corpo:
        campos = l.split("\t")
        if len(campos) != len(cols):
            raise ValueError(f"linha {n}: {len(campos)} colunas, esperado {len(cols)}")
        r = dict(zip(cols, campos))
        r[col] = unicodedata.normalize("NFC", r[col]).strip()
        r["origem"] = r["origem"].strip().lower()
        if r["origem"] not in ORIGENS_RESPOSTA:
            raise ValueError(f"linha {n}: origem inválida {r['origem']!r} (use revisado ou sem)")
        if r["origem"] == "revisado":
            if not r[col]:
                raise ValueError(f"linha {n}: origem revisado sem nome")
            if not escrita_ok(lang, r[col]):
                raise ValueError(f"linha {n}: {r[col]!r} não está na escrita de {lang}")
        if not r["nota"].startswith(PREFIXO_NOTA):
            raise ValueError(f"linha {n}: a nota deve começar com {PREFIXO_NOTA!r}")
        chave = (r["nome_en"], r[chave_col])
        if not r["nome_en"] or chave in vistos:
            raise ValueError(f"linha {n}: nome_en vazio ou chave repetida {chave!r}")
        vistos.add(chave)
        out.append(r)
    return tipo, out


def _le_notas(arq: Path, cols: list[str]) -> list[dict]:
    if not arq.exists():
        return []
    linhas = [l for l in arq.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]
    if not linhas:
        return []
    corpo = linhas[1:]
    return [dict(zip(cols, (l.split("\t") + [""] * len(cols))[: len(cols)])) for l in corpo]


def _grava_com_cabecalho(arq: Path, comentario: list[str], cols: list[str], linhas: list[dict]) -> None:
    arq.parent.mkdir(parents=True, exist_ok=True)
    corpo = ["\t".join(cols)] + ["\t".join(r.get(c, "") for c in cols) for r in linhas]
    arq.write_text("\n".join(comentario + corpo) + "\n", encoding="utf-8")


COMENTARIO_NOTAS = [
    "# Notas da revisão de nomes por agentes de IA (uma linha por nome_en + candidato, ou nome_en + tipo).",
    "# Conferidas no texto da Bíblia da língua e na tradução inglesa. Só registro: o ingestor não lê este arquivo.",
]


def aplica(lang: str, arquivos: list[Path]) -> dict[str, int]:
    """Valida todas as respostas e só então grava. Devolve contagens por tipo."""
    col = f"nome_{lang}"
    tsv = caminho(lang, "nomes")
    notas_arq = caminho(lang, "nomes-revisao")
    manuais_arq = caminho(lang, "nomes-manuais")
    respostas = []
    for arq in arquivos:
        try:
            respostas.append((arq, *valida_resposta(arq.read_text(encoding="utf-8"), lang)))
        except ValueError as e:
            raise ValueError(f"{arq}: {e}") from None
    contagem = {"revisao": 0, "manual": 0}

    rows = N.ler_tsv(tsv, lang) if tsv.exists() else []
    por_chave = {(r["nome_en"], r["candidato"]): r for r in rows}
    notas_rev = {(r["nome_en"], r["candidato"]): r for r in _le_notas(notas_arq, cabecalho_revisao(lang))}
    manuais_rows = _le_notas(manuais_arq, cabecalho_manual(lang))
    manuais = {(r["nome_en"], r["tipo"]): r for r in manuais_rows}
    for arq, tipo, linhas in respostas:
        for r in linhas:
            if tipo == "revisao":
                chave = (r["nome_en"], r["candidato"])
                alvo = por_chave.get(chave)
                if alvo is None:
                    raise ValueError(f"{arq}: chave fora do TSV: {chave!r}")
                alvo[col] = r[col] if r["origem"] == "revisado" else alvo[col]
                alvo["origem"] = r["origem"]
                notas_rev[chave] = {"nome_en": r["nome_en"], "candidato": r["candidato"], col: r[col],
                                    "origem": r["origem"], "nota": r["nota"]}
            else:
                chave = (r["nome_en"], r["tipo"])
                manuais[chave] = {"nome_en": r["nome_en"], "tipo": r["tipo"], col: r[col], "origem": r["origem"],
                                  "nota": r["nota"]}
            contagem[tipo] += 1

    N.escrever_tsv(tsv, lang, rows)
    _grava_com_cabecalho(notas_arq, COMENTARIO_NOTAS, cabecalho_revisao(lang), list(notas_rev.values()))
    _grava_com_cabecalho(manuais_arq, COMENTARIO_NOTAS, cabecalho_manual(lang), list(manuais.values()))
    return contagem


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--lang", required=True, choices=list(LINGUAS))
    ap.add_argument("respostas", nargs="+", type=Path)
    a = ap.parse_args()
    print(aplica(a.lang, a.respostas))
