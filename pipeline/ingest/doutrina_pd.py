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
}


# ---- texto ----------------------------------------------------------------

def corpo_do_volume(texto: str, volume: Volume) -> str:
    """Texto entre a linha de início e a de fim do Project Gutenberg, até a linha que encerra o corpo."""
    inicio = START.search(texto)
    fim = END.search(texto)
    corpo = texto[inicio.end() if inicio else 0:fim.start() if fim else len(texto)]
    m = re.search(volume.fim, corpo, re.M)
    return corpo[:m.start()] if m else corpo


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
        for linhas in blocos(corpo_do_volume(bruto, volume)):
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
            texto = paragrafo(linhas)
            refs = find_refs(texto)
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
                "Só parágrafos com referência bíblica explícita geram linhas (uma por referência). O cabeçalho do "
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
