"""Aplica as respostas dos agentes (folhas de folhas_descricoes.py) às correções da língua. Valida tudo antes de gravar.

Formato das respostas (UTF-8 em NFC, primeira linha = cabeçalho exato, sem comentário, campos separados por tab; sem
tab nem quebra de linha dentro de um campo; em prosa, quebra de linha é \\n):
  gramatica: chave<TAB>modelo                          -> corrections/<xx>/gramatica-descricoes.tsv
  glossário: secao<TAB>ingles<TAB>portugues<TAB>nota<TAB>genero
             -> corrections/<xx>/glossario-descricoes.tsv (seções de descrição) ou glossario-geo.tsv (tipo, geometria,
                voto, fonte). Não se misturam as duas numa resposta.
  prosa:     chave<TAB>fonte<TAB>descricao_<xx><TAB>origem<TAB>nota -> corrections/<xx>/descricoes.tsv
Origem: revisado ou sem. Linha de mesma chave (ou mesmo termo da mesma seção) substitui a anterior; o resto fica.

Uso (raiz do repositório):
    python3 pipeline/ingest/aplica_descricoes.py --lang es tmp/traducao/es/resposta-*.tsv
Se alguma resposta for inválida, termina com erro e não grava nada. O pt não passa por aqui (tem os arquivos legados).
"""

import argparse
import re
import sys
import unicodedata
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from descricoes import ler_tsv  # noqa: E402
from sensus.correcoes import caminho  # noqa: E402
from sensus.descricoes_pt import GRAMATICA_PT, SECOES, ler_gramatica  # noqa: E402
from sensus.geo_descricao import CHAVES_GEO, SECOES_GEO  # noqa: E402
from sensus.linguas import LINGUAS  # noqa: E402

ORIGENS = ("revisado", "sem")
GENEROS = ("", "m", "f", "n")
CAMPOS_GRAMATICA = frozenset({"ref", "frase", "cargo", "comp", "tempo", "tribo", "perto", "nome", "lista", "mencao",
                              "x", "original", "pont.;", "pont..", "pont.,", "tipo", "geometria", "score", "texto", "fonte",
                              "votos", "voto", "n"})
CHAVES_GRAMATICA = frozenset(GRAMATICA_PT) | frozenset(CHAVES_GEO)


class Invalida(Exception):
    pass


def _confere_nfc(arquivo: str, n: int, campos: list[str]) -> None:
    for c in campos:
        if not unicodedata.is_normalized("NFC", c):
            raise Invalida(f"{arquivo}, linha {n}: texto fora de NFC")


def tipo_da_resposta(cabecalho: list[str], lang: str) -> str:
    if cabecalho == ["chave", "modelo"]:
        return "gramatica"
    if cabecalho == ["secao", "ingles", "portugues", "nota", "genero"]:
        return "glossario"
    if cabecalho == ["chave", "fonte", f"descricao_{lang}", "origem", "nota"]:
        return "prosa"
    raise Invalida(f"cabeçalho não reconhecido: {cabecalho!r}")


def le_resposta(arquivo: str, texto: str, lang: str) -> tuple[str, list[tuple[int, list[str]]]]:
    """(tipo, linhas) já com o cabeçalho conferido. Linhas vazias e comentários não contam."""
    linhas = [(n, l) for n, l in enumerate(texto.splitlines(), 1) if l.strip() and not l.startswith("#")]
    if not linhas:
        raise Invalida(f"{arquivo}: resposta vazia")
    (_, cab), *corpo = linhas
    tipo = tipo_da_resposta(cab.split("\t"), lang)
    tamanho = len(cab.split("\t"))
    out = []
    for n, l in corpo:
        campos = l.split("\t")
        if len(campos) != tamanho:
            raise Invalida(f"{arquivo}, linha {n}: {len(campos)} campos (esperado {tamanho})")
        _confere_nfc(arquivo, n, campos)
        out.append((n, campos))
    return tipo, out


def valida_gramatica(arquivo: str, linhas: list[tuple[int, list[str]]]) -> dict[str, str]:
    out: dict[str, str] = {}
    for n, (chave, modelo) in linhas:
        if chave not in CHAVES_GRAMATICA and not (chave.endswith(".f") and chave[:-2] in GRAMATICA_PT):
            raise Invalida(f"{arquivo}, linha {n}: chave desconhecida {chave!r}")
        if not modelo.strip():
            raise Invalida(f"{arquivo}, linha {n}: modelo vazio")
        for campo in re.findall(r"\{([^{}]*)\}", modelo):
            if campo not in CAMPOS_GRAMATICA:
                raise Invalida(f"{arquivo}, linha {n}: campo {{{campo}}} desconhecido")
        out[chave] = modelo
    return out


def valida_glossario(arquivo: str, linhas: list[tuple[int, list[str]]]) -> tuple[str, dict[tuple[str, str], list[str]]]:
    """Devolve o alvo ('descricoes' ou 'geo') e as linhas por (seção, termo)."""
    secoes = {campos[0] for _, campos in linhas}
    if secoes <= set(SECOES_GEO):
        alvo, validas = "geo", SECOES_GEO
    elif secoes <= set(SECOES):
        alvo, validas = "descricoes", SECOES
    else:
        raise Invalida(f"{arquivo}: seções misturadas ou desconhecidas: {sorted(secoes)}")
    out: dict[tuple[str, str], list[str]] = {}
    for n, (secao, ingles, portugues, nota, genero) in linhas:
        if secao not in validas:
            raise Invalida(f"{arquivo}, linha {n}: seção {secao!r} inválida")
        if not ingles.strip() or not portugues.strip():
            raise Invalida(f"{arquivo}, linha {n}: termo ou tradução vazio")
        if genero not in GENEROS:
            raise Invalida(f"{arquivo}, linha {n}: gênero {genero!r} inválido (m, f, n ou vazio)")
        out[(secao, ingles)] = [secao, ingles, portugues, nota, genero]
    return alvo, out


def valida_prosa(arquivo: str, linhas: list[tuple[int, list[str]]], lang: str) -> dict[str, list[str]]:
    for n, campos in linhas:
        if campos[3] not in ORIGENS:
            raise Invalida(f"{arquivo}, linha {n}: origem {campos[3]!r} inválida (revisado ou sem)")
    return {campos[0]: campos for _, campos in linhas}


def _completa(campos: list[str], n: int) -> list[str]:
    """Linha do arquivo com menos campos (nota ou genero vazios não escritos): completa com vazio."""
    return (campos + [""] * n)[:n]


def le_tsv_existente(path: Path) -> tuple[list[str], list[list[str]]]:
    """(comentários do topo, linhas de dados) do arquivo da língua, para regravar sem perder o cabeçalho de comentário."""
    if not path.exists():
        return [], []
    texto = path.read_text(encoding="utf-8")
    comentarios = [l for l in texto.splitlines() if l.startswith("#")]
    dados = [l.split("\t") for l in texto.splitlines() if l.strip() and not l.startswith("#")]
    return comentarios, dados[1:]


def grava(path: Path, comentarios: list[str], cabecalho: list[str], linhas: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    texto = "\n".join([*comentarios, "\t".join(cabecalho), *("\t".join(l) for l in linhas)]) + "\n"
    path.write_text(texto, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--lang", required=True)
    parser.add_argument("respostas", nargs="+", help="arquivos de resposta (tab)")
    args = parser.parse_args()
    lang = args.lang
    if lang == "pt":
        raise SystemExit("o pt tem os arquivos legados (ingest/descricoes_pt.py); aplica_descricoes é para as 12 línguas")
    if lang not in LINGUAS:
        raise SystemExit(f"língua desconhecida: {lang!r}")

    gram_path = caminho(lang, "gramatica-descricoes")
    desc_path = caminho(lang, "glossario-descricoes")
    geo_path = caminho(lang, "glossario-geo")
    tsv_path = caminho(lang, "descricoes")

    # Estado em memória: cada resposta mescla antes de gravar qualquer arquivo.
    gram_com, gram = ([], {}) if not gram_path.exists() else (
        [l for l in gram_path.read_text(encoding="utf-8").splitlines() if l.startswith("#")],
        ler_gramatica(gram_path.read_text(encoding="utf-8")))
    desc_com, desc_linhas = le_tsv_existente(desc_path)
    geo_com, geo_linhas = le_tsv_existente(geo_path)
    prosa_com, prosa_linhas = le_tsv_existente(tsv_path)
    desc_map = {(l[0], l[1]): _completa(l, 5) for l in desc_linhas if len(l) >= 3}
    geo_map = {(l[0], l[1]): _completa(l, 5) for l in geo_linhas if len(l) >= 3}
    prosa_map = {l[0]: _completa(l, 5) for l in prosa_linhas if l}
    tocados = set()
    try:
        for arquivo in args.respostas:
            texto = Path(arquivo).read_text(encoding="utf-8")
            tipo, linhas = le_resposta(arquivo, texto, lang)
            if tipo == "gramatica":
                gram.update(valida_gramatica(arquivo, linhas))
                tocados.add("gramatica")
            elif tipo == "glossario":
                alvo, pares = valida_glossario(arquivo, linhas)
                destino = desc_map if alvo == "descricoes" else geo_map
                destino.update({k: v for k, v in pares.items()})
                tocados.add(alvo)
            else:
                prosa_map.update(valida_prosa(arquivo, linhas, lang))
                tocados.add("prosa")
    except Invalida as erro:
        raise SystemExit(f"nada gravado: {erro}")

    # Validação final com os leitores do pipeline (cada um reconhece erro de formato e de chave).
    if "prosa" in tocados:
        cab = ["chave", "fonte", f"descricao_{lang}", "origem", "nota"]
        ler_tsv("\n".join(["\t".join(cab), *("\t".join(v) for v in prosa_map.values())]) + "\n", lang, tsv_path.name)
    if "gramatica" in tocados:
        ler_gramatica("\n".join(["chave\tmodelo", *("\t".join(kv) for kv in gram.items())]) + "\n")

    if "gramatica" in tocados:
        ordem = {k: i for i, k in enumerate([*GRAMATICA_PT, *CHAVES_GEO])}
        chaves = sorted(gram, key=lambda k: (ordem.get(k, len(ordem)), k))
        grava(gram_path, gram_com or [f"# Gramática das descrições em {lang} (chave<TAB>modelo); ver sensus/descricoes_pt.py"],
              ["chave", "modelo"], [[k, gram[k]] for k in chaves])
        print(f"gravado: {gram_path} ({len(gram)} chaves)")
    if "descricoes" in tocados:
        grava(desc_path, desc_com or ["# Glossário das descrições (TIPNR por regra). Colunas: secao, ingles, portugues, nota, genero."],
              ["secao", "ingles", "portugues", "nota", "genero"], list(desc_map.values()))
        print(f"gravado: {desc_path} ({len(desc_map)} termos)")
    if "geo" in tocados:
        grava(geo_path, geo_com or ["# Glossário geo (openbible-geo): tipo, geometria, voto, fonte."],
              ["secao", "ingles", "portugues", "nota", "genero"], list(geo_map.values()))
        print(f"gravado: {geo_path} ({len(geo_map)} termos)")
    if "prosa" in tocados:
        grava(tsv_path, prosa_com or ["# Textos das descrições que a regra não traduz (revisados). Escapes: \\n e \\\\."],
              ["chave", "fonte", f"descricao_{lang}", "origem", "nota"], list(prosa_map.values()))
        print(f"gravado: {tsv_path} ({len(prosa_map)} textos)")


if __name__ == "__main__":
    main()
