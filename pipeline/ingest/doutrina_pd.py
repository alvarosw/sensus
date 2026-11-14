"""Ingere obras de doutrina (teologia sistemática) em domínio público como comentários por referência.

Cada parágrafo do corpo com referência inequívoca (ingest/refparse.py, find_refs) vira uma linha por referência, com
cite_id com:<fonte>:<início>-<fim>. O texto da linha começa com "<autor> — <obra>, <parte>, <capítulo>[, <seção>]" e
segue com o parágrafo inteiro. Parágrafo sem referência sai, com contagem. Ficam fora: o prefácio e o sumário (antes da
primeira parte ou livro) e os índices (no fim do volume).

Estrutura do texto (Gutenberg, texto simples): cabeçalhos "PART I. ...", "Chapter I. ...", "Section I.—..." (ou "BOOK I.",
em maiúsculas ou centralizados) em linha própria, seguidos de linha em branco. O sumário é um bloco com várias linhas de
cabeçalho e não muda o capítulo atual. Parágrafos são blocos separados por linha em branco, com as linhas juntadas.

Obras (ver DATA_LICENSES.md):
- strong-systematic: A. H. Strong, Systematic Theology (1907; autor falecido em 1921; batista). Gutenberg #44035,
  #44555 e #45283 (volumes 1 a 3).

Uso:
    cd pipeline && .venv/bin/python -I ingest/doutrina_pd.py [strong-systematic]
"""

import hashlib
import re
import sys
import time
import urllib.request
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import RAW, StagingWriter, cite_com  # noqa: E402
from ingest.refparse import find_refs  # noqa: E402

UA = "Mozilla/5.0 (sensus-ingest; local research pipeline)"
GUT_LICENSE_URL = "https://www.gutenberg.org/policy/license.html"
START = re.compile(r"^\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG.*$", re.M)
END = re.compile(r"^\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG.*$", re.M)
ITALICO = re.compile(r"_([^_]+)_")
ORNAMENTO = re.compile(r"^[\s*]*$")

# Cabeçalho de parte, livro, capítulo ou seção, sozinho na primeira linha do bloco. O resto da linha tem de começar
# com ponto, travessão, fim ou maiúscula ("Chapter II shows that" é prosa, não cabeçalho).
_CABECALHO = re.compile(
    r"^\s*(?P<nivel>PART|Part|BOOK|Book|CHAPTER|Chapter|SECTION|Section)\s+(?P<num>[IVXL]+|\d+)\b(?P<resto>.*)$")
_RESTO_OK = re.compile(r"^\s*(?:\.|—|$|[A-Z(])")
_NIVEIS = {"part": "parte", "book": "parte", "chapter": "capitulo", "section": "secao"}


@dataclass(frozen=True)
class Volume:
    ebook: int          # eBook do Project Gutenberg
    rotulo: str         # conteúdo do volume (para o log)
    fim: str            # regex (linha inteira) que encerra o corpo: índice ou notas do volume
    # Notas de rodapé: marca no texto (regex com grupo 1 = número da nota) e formato das notas depois de `fim`.
    # "linha": "    12 Rom. viii. 30." (uma nota por entrada, com continuação indentada); "bloco": "Footnote 12:" e o texto.
    marca: str | None = None
    notas: str | None = None


@dataclass(frozen=True)
class Obra:
    source_id: str
    title: str          # título da obra, em inglês
    short: str          # título curto, no cabeçalho do verbete
    author: str         # autor com datas, como no cabeçalho do verbete
    edition: str        # edição e data de publicação
    url: str            # página de origem (leitura humana)
    rights: str         # justificativa de domínio público, para attribution
    pd: str             # trecho da atribuição sobre o domínio público
    tradition: str      # chave de TRADITIONS (packages/core/src/domain/sources.ts)
    volumes: tuple[Volume, ...]
    romano: bool = False  # lê referências em capítulo romano minúsculo ("Rom. viii. 30"; refparse, romano=True)


OBRAS = {
    "strong-systematic": Obra(
        source_id="strong-systematic",
        title="Systematic Theology",
        short="Systematic Theology",
        author="Augustus Hopkins Strong (1836-1921)",
        edition="The Judson Press, 1907 (edição revisada e ampliada; três volumes)",
        url="https://www.gutenberg.org/ebooks/44035",
        rights="Project Gutenberg eBooks #44035, #44555 e #45283",
        pd=("Domínio público: autor falecido em 1921 e obra publicada em 1907 (domínio público nos EUA); "
            "no Brasil, autor falecido há mais de 70 anos."),
        tradition="baptist",
        volumes=(
            Volume(44035, "vol. 1, The Doctrine of God", r"^Index Of"),
            Volume(44555, "vol. 2, The Doctrine of Man", r"^Index Of"),
            Volume(45283, "vol. 3, The Doctrine of Salvation", r"^Index Of"),
        ),
    ),
    "calvin-institutes": Obra(
        source_id="calvin-institutes",
        title="Institutes of the Christian Religion",
        short="Institutes of the Christian Religion",
        author="John Calvin (1509-1564)",
        edition=("Presbyterian Board of Publication, Filadélfia, sexta edição americana revisada e corrigida "
                 "(1813 no volume 1); tradução de John Allen"),
        url="https://www.gutenberg.org/ebooks/45001",
        rights="Project Gutenberg eBooks #45001 (vol. 1) e #64392 (vol. 2)",
        pd=("Domínio público: autor falecido em 1564; tradução de John Allen publicada em 1813 (domínio público nos "
            "EUA); no Brasil, autor falecido há mais de 70 anos."),
        tradition="reformed",
        volumes=(
            # Volume 1 (livros I a III): notas no fim, depois de "FOOTNOTES", com a marca "(n)" no texto.
            Volume(45001, "vol. 1, livros I a III", r"^FOOTNOTES\s*$", marca=r"\((\d{1,4})\)", notas="linha"),
            # Volume 2 (livros IV e V): notas depois de "END OF THE INSTITUTES.", com a marca "[n]" no texto.
            Volume(64392, "vol. 2, livros IV e V", r"^END OF THE INSTITUTES\.", marca=r"\[(\d{1,4})\]", notas="bloco"),
        ),
        romano=True,
    ),
}


# ---- texto ----------------------------------------------------------------

def corpo_do_volume(texto: str, volume: Volume) -> str:
    """Texto entre a linha de início e a de fim do Project Gutenberg, até a linha que encerra o corpo."""
    inicio = START.search(texto)
    fim = END.search(texto)
    corpo = texto[inicio.end() if inicio else 0:fim.start() if fim else len(texto)]
    m = re.search(volume.fim, corpo, re.M)
    return corpo[:m.start()] if m else corpo


_NOTA_LINHA = re.compile(r"^ {1,5}(\d{1,4}) +(\S.*)$")  # entrada: recuo de até 5 espaços; continuação tem 6
_NOTA_BLOCO = re.compile(r"^Footnote (\d{1,4}):\s*$")


def _notas_em_bloco(texto: str, romano: bool) -> dict[int, list[tuple[int, int]]]:
    """Notas "Footnote N:" do volume 2: cada uma é o cabeçalho e, logo depois, o bloco com o texto.

    No Gutenberg, as notas 1 a 1403 ficam no corpo, depois de cada capítulo, e só as últimas ficam depois de
    "END OF THE INSTITUTES.". Por isso o volume inteiro é varrido, e `blocos_sem_notas` tira essas notas do corpo.
    """
    inicio = START.search(texto)
    fim = END.search(texto)
    out: dict[int, list[tuple[int, int]]] = {}
    atual = None
    for linhas in blocos(texto[inicio.end() if inicio else 0:fim.start() if fim else len(texto)]):
        h = _NOTA_BLOCO.match(linhas[0]) if len(linhas) == 1 else None
        if h:
            atual = int(h.group(1))
            continue
        if atual is not None:
            refs = find_refs(" ".join(linha.strip() for linha in linhas), romano=romano)
            if refs:
                out[atual] = refs
            atual = None
    return out


def blocos_sem_notas(lista: list[list[str]]) -> list[list[str]]:
    """Tira do corpo as notas "Footnote N:" (cabeçalho e bloco de texto seguinte)."""
    out, pula = [], False
    for linhas in lista:
        if pula:
            pula = False
            continue
        if len(linhas) == 1 and _NOTA_BLOCO.match(linhas[0]):
            pula = True
            continue
        out.append(linhas)
    return out


def notas_do_volume(texto: str, volume: Volume, romano: bool) -> dict[int, list[tuple[int, int]]]:
    """Referências de cada nota de rodapé do volume (número -> pares de vid). Nota sem referência fica de fora."""
    if volume.notas is None:
        return {}
    if volume.notas == "bloco":
        return _notas_em_bloco(texto, romano)
    inicio = START.search(texto)
    fim = END.search(texto)
    resto = texto[inicio.end() if inicio else 0:fim.start() if fim else len(texto)]
    m = re.search(volume.fim, resto, re.M)
    if not m:
        return {}
    entradas: dict[int, list[str]] = {}
    atual = None
    for linha in resto[m.end():].split("\n"):
        if volume.notas == "linha":
            h = _NOTA_LINHA.match(linha)
            if h:
                atual = int(h.group(1))
                entradas[atual] = [h.group(2)]
                continue
        else:
            h = _NOTA_BLOCO.match(linha)
            if h:
                atual = int(h.group(1))
                entradas[atual] = []
                continue
        if atual is not None and linha.strip():
            entradas[atual].append(linha.strip())
    out = {}
    for n, partes in entradas.items():
        refs = find_refs(" ".join(partes), romano=romano)
        if refs:
            out[n] = refs
    return out


def tira_marcas(texto: str, volume: Volume, notas: dict) -> tuple[str, list[int]]:
    """Tira a marca de nota (ex.: "(118)") que tem nota com referência; devolve o texto e os números tirados."""
    usadas: list[int] = []

    def troca(m):
        n = int(m.group(1))
        if n in notas:
            usadas.append(n)
            return ""
        return m.group(0)

    return re.sub(volume.marca, troca, texto) if volume.marca else texto, usadas


def cabecalho(linhas: list[str]) -> tuple[str, str] | None:
    """(nível, rótulo) se o bloco é um cabeçalho de parte, livro, capítulo ou seção; senão None.

    Sumário (bloco com dois ou mais cabeçalhos) não é cabeçalho: não muda o capítulo atual.
    """
    if sum(bool(_CABECALHO.match(linha)) for linha in linhas) >= 2:
        return None
    m = _CABECALHO.match(linhas[0])
    if not m or len(linhas[0].strip()) > 150 or not _RESTO_OK.match(m.group("resto")):
        return None
    nivel = m.group("nivel")
    return _NIVEIS[nivel.lower()], f"{nivel.capitalize()} {m.group('num')}"


def paragrafo(linhas: list[str]) -> str:
    """Texto do bloco: linhas juntadas, itálico do Gutenberg (_x_) tirado, espaços simples."""
    p = " ".join(linha.strip() for linha in linhas)
    return re.sub(r"\s{2,}", " ", ITALICO.sub(r"\1", p)).strip()


def blocos(corpo: str) -> list[list[str]]:
    """Blocos de linhas não vazias, separados por linha em branco."""
    out = []
    for bloco in re.split(r"\n\s*\n", corpo):
        linhas = [linha for linha in bloco.split("\n") if linha.strip()]
        if linhas:
            out.append(linhas)
    return out


def cabeca(obra: Obra, estado: dict) -> str:
    """Cabeçalho do verbete: "Autor — Obra, Part I, Chapter II, Section I" (só os níveis já lidos)."""
    partes = [estado[k] for k in ("parte", "capitulo", "secao") if estado[k]]
    return f"{obra.author} — {obra.short}" + "".join(f", {p}" for p in partes)


def linhas_da_obra(textos: list[tuple[Volume, str]], obra: Obra) -> tuple[list[tuple[int, int, str]], Counter]:
    """(start_vid, end_vid, texto) de cada referência, e contagens dos parágrafos."""
    stats: Counter = Counter()
    rows: list[tuple[int, int, str]] = []
    for volume, bruto in textos:
        estado = {"parte": None, "capitulo": None, "secao": None}
        notas = notas_do_volume(bruto, volume, romano=obra.romano)
        stats["notas com referência"] += len(notas)
        lista = blocos(corpo_do_volume(bruto, volume))
        if volume.notas == "bloco":
            lista = blocos_sem_notas(lista)
        for linhas in lista:
            h = cabecalho(linhas)
            if h is not None:
                nivel, rotulo = h
                if nivel == "parte":
                    estado = {"parte": rotulo, "capitulo": None, "secao": None}
                elif nivel == "capitulo":
                    estado = {**estado, "capitulo": rotulo, "secao": None}
                else:
                    estado = {**estado, "secao": rotulo}
                stats["cabeçalhos"] += 1
                continue
            if ORNAMENTO.match(" ".join(linhas)):
                continue
            if estado["parte"] is None:  # prefácio e sumário, antes da primeira parte ou livro
                stats["prefácio e sumário (fora)"] += 1
                continue
            stats["parágrafos"] += 1
            texto, marcas = tira_marcas(paragrafo(linhas), volume, notas)
            refs = find_refs(texto, romano=obra.romano)
            for n in marcas:  # a nota do rodapé vale para o parágrafo que a marca
                refs += [r for r in notas[n] if r not in refs]
                stats["marcas de nota ligadas"] += 1
            if not refs:
                stats["sem referência"] += 1
                continue
            stats["com referência"] += 1
            stats["referências"] += len(refs)
            head = cabeca(obra, estado)
            for start, end in refs:
                rows.append((start, end, f"{head}\n\n{texto}"))
    return rows, stats


# ---- download e gravação --------------------------------------------------

def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def baixa(n: int, dest: Path) -> Path:
    """Baixa o eBook n (texto simples UTF-8) se ainda não estiver em data/raw. Uma requisição por vez."""
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(f"https://www.gutenberg.org/cache/epub/{n}/pg{n}.txt", headers={"User-Agent": UA})
    tmp = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 16):
            f.write(chunk)
    tmp.rename(dest)
    time.sleep(3)  # respeita o Gutenberg: pausa entre downloads
    return dest


def ingest(obra: Obra) -> None:
    textos = []
    hashes = []
    for volume in obra.volumes:
        path = baixa(volume.ebook, RAW / obra.source_id / f"pg{volume.ebook}.txt")
        textos.append((volume, path.read_text(encoding="utf-8-sig")))
        hashes.append(f"pg{volume.ebook} {sha256_of(path)[:12]}")
    rows, stats = linhas_da_obra(textos, obra)
    print(f"[{obra.source_id}] {dict(stats)}")

    with StagingWriter(obra.source_id) as w:
        w.source(
            kind="commentary",
            title=obra.title,
            author=obra.author,
            lang="en",
            license="Public Domain",
            license_url=GUT_LICENSE_URL,
            url=obra.url,
            version=f"{obra.edition}; Project Gutenberg, " + ", ".join(f"#{v.ebook}" for v in obra.volumes)
                    + "; arquivos " + "; ".join(hashes),
            attribution=(
                f"{obra.title}, {obra.author}. {obra.edition}. Fonte do texto: {obra.rights}, sem o cabeçalho e o "
                f"rodapé da licença do Project Gutenberg. {obra.pd}"
            ),
            tradition=obra.tradition,
            notes=(
                "Só parágrafos com referência bíblica explícita geram linhas (uma por referência). Nota de rodapé com "
                "referência vale para o parágrafo que tem a marca dela no texto. O cabeçalho do "
                "verbete traz autor, obra e a parte e o capítulo do parágrafo. Prefácio, sumário e índices ficam fora. "
                "Texto em inglês."
            ),
        )
        seen: Counter = Counter()
        for start, end, text in sorted(rows, key=lambda r: (r[0], r[1])):
            base = cite_com(obra.source_id, start, end)
            seen[base] += 1
            cite = base if seen[base] == 1 else f"{base}.{seen[base]}"
            w.row("commentary", cite_id=cite, start_vid=start, end_vid=end, text=text)


def main() -> None:
    only = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    for source_id, obra in OBRAS.items():
        if only is None or source_id in only:
            ingest(obra)


if __name__ == "__main__":
    main()
