"""Ingestor: Bíblia Livre (BLIVRE), tradução portuguesa (edição Textus Receptus do NT).

Fonte: eBible.org, porbr2018 (USFM zip). Licença do projeto (LICENCA.md do repositório
github.com/blivre/BibliaLivre): Creative Commons Atribuição 3.0 Brasil.

Versificação: já coincide com a KJV (1189 capítulos, 31102 versículos, Salmos com os
títulos fora do versículo 1, Joel com 3 capítulos, Malaquias com 4), então nenhuma
conversão é feita; as asserções abaixo garantem isso.

Uso:
    cd pipeline && .venv/bin/python -I ingest/blivre.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import re  # noqa: E402
import urllib.request  # noqa: E402
import zipfile  # noqa: E402

from sensus.refs import BOOK_BY_NUM, book_num, vid  # noqa: E402
from sensus.staging import RAW, StagingWriter, cite_txt  # noqa: E402

SOURCE_ID = "blivre"
RAW_DIR = RAW / SOURCE_ID
ZIP_URL = "https://ebible.org/Scriptures/porbr2018_usfm.zip"
ZIP_PATH = RAW_DIR / "porbr2018_usfm.zip"
LICENCE_URL = "https://raw.githubusercontent.com/blivre/BibliaLivre/master/LICENCA.md"
LICENCE_PATH = RAW_DIR / "LICENCA.md"
EXPECTED_VERSES = 31102
EXPECTED_CHAPTERS = 1189

# Padrões de linha USFM
RE_ID = re.compile(r"^\\id\s+(\S+)")
RE_CHAPTER = re.compile(r"^\\c\s+(\d+)\s*$")
RE_VERSE = re.compile(r"^\\v\s+(\d+)(?:\s|$)(.*)$")
RE_HEADING = re.compile(r"^\\(?:ms\d?|s\d?|d)\s+(.*)$")  # \s, \ms e \d (títulos dos Salmos)
RE_PARA = re.compile(r"^\\(?:p|m|pmo|pm|pmc|pi\d?|mi|nb)(?:\s+(.*))?$")
RE_MARKER = re.compile(r"^\\([a-zA-Z0-9]+)")
# Marcadores que não carregam texto de versículo.
IGNORED = {"ide", "h", "toc1", "toc2", "toc3", "mt1", "mt2", "mt3", "rem", "usfm"}


def fetch(url: str, dest: Path) -> None:
    """Baixa url para dest, só se ainda não existir (idempotente)."""
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "sensus-ingest/1.0"})
    tmp = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:
        f.write(r.read())
    tmp.rename(dest)


def clean(s: str) -> str:
    """Remove notas, referências e marcação USFM; devolve texto puro em uma linha."""
    s = re.sub(r"\\f\s.*?\\f\*", " ", s, flags=re.S)        # notas de rodapé
    s = re.sub(r"\\x\s.*?\\x\*", " ", s, flags=re.S)        # notas de referências cruzadas
    s = re.sub(r"\\fig\s.*?\\fig\*", " ", s, flags=re.S)    # figuras
    s = re.sub(r"\\rq\s.*?\\rq\*", " ", s, flags=re.S)      # referência de citação (ex.: Mt 4:4)
    s = re.sub(r"(?<=\S)\\\+?[a-zA-Z0-9]+\s", " ", s)       # marcador de abertura colado a palavra (\add)
    s = re.sub(r"\\\+?[a-zA-Z0-9]+\*", "", s)               # marcadores de fechamento (\add*)
    s = re.sub(r"\\\+?[a-zA-Z0-9]+", " ", s)                # demais marcadores de abertura
    return re.sub(r"\s+", " ", s).strip()


def parse_usfm(text: str) -> dict:
    """Converte um livro USFM em versículos, títulos e inícios de parágrafo.

    Títulos e parágrafos são associados ao primeiro versículo que vem depois deles.
    Retorna {code, verses: [(cap, vers, texto)], heads: [(cap, vers, título)], paras: [(cap, vers)]}.
    """
    out = {"code": None, "verses": [], "heads": [], "paras": []}
    chap = None
    cur = None          # (cap, vers) do versículo em andamento
    buf: list[str] = []
    pend_heads: list[str] = []
    pend_para = False

    def close_verse():
        if cur is not None:
            out["verses"].append((cur[0], cur[1], clean(" ".join(buf))))

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        if m := RE_ID.match(line):
            out["code"] = m.group(1)
            continue

        if m := RE_CHAPTER.match(line):
            close_verse()
            cur, buf = None, []
            chap = int(m.group(1))
            continue

        if m := RE_VERSE.match(line):
            close_verse()
            if chap is None:
                raise ValueError(f"{out['code']}: \\v antes de \\c")
            cur = (chap, int(m.group(1)))
            buf = [m.group(2)]
            for t in pend_heads:
                out["heads"].append((cur[0], cur[1], t))
            if pend_para:
                out["paras"].append(cur)
            pend_heads, pend_para = [], False
            continue

        if m := RE_HEADING.match(line):
            pend_heads.append(clean(m.group(1)))
            continue

        if m := RE_PARA.match(line):
            pend_para = True
            rest = m.group(1)
            if rest and cur is not None:  # texto na mesma linha do marcador de parágrafo
                buf.append(rest)
            continue

        marker = RE_MARKER.match(line)
        if marker and marker.group(1) in IGNORED:
            continue
        if cur is not None:
            buf.append(line)  # continuação do versículo (inclui marcadores de texto)

    close_verse()
    if pend_heads or pend_para:
        raise ValueError(f"{out['code']}: título/parágrafo sem versículo seguinte")
    return out


def main():
    fetch(ZIP_URL, ZIP_PATH)
    fetch(LICENCE_URL, LICENCE_PATH)
    if not zipfile.is_zipfile(ZIP_PATH):
        raise RuntimeError(f"arquivo não é um zip válido: {ZIP_PATH}")

    books = []
    with zipfile.ZipFile(ZIP_PATH) as z:
        names = sorted(n for n in z.namelist() if n.lower().endswith(".usfm"))
        for name in names:
            # Conteúdo é só lido como texto; nada é extraído nem executado.
            text = z.read(name).decode("utf-8-sig")
            books.append(parse_usfm(text))

    writer_rows = {"verse_text": [], "text_division": []}
    total = 0
    chapters = 0
    seen_books = set()
    seen_div = set()

    for b in books:
        bnum = book_num(b["code"])
        if bnum in seen_books:
            raise ValueError(f"livro duplicado: {b['code']}")
        seen_books.add(bnum)
        meta = BOOK_BY_NUM[bnum]
        code = b["code"]

        # Versificação: capítulos e versículos sequenciais, contagem igual à KJV.
        per_chap: dict[int, list[int]] = {}
        for c, v, _ in b["verses"]:
            per_chap.setdefault(c, []).append(v)
        if sorted(per_chap) != list(range(1, meta[5] + 1)):
            raise ValueError(f"{code}: capítulos {sorted(per_chap)} != 1..{meta[5]} (KJV {meta[1]})")
        for c, vs in per_chap.items():
            if vs != list(range(1, len(vs) + 1)):
                raise ValueError(f"{code} {c}: versículos fora de sequência: {vs[:10]}")
        chapters += len(per_chap)

        for c, v, t in b["verses"]:
            if not t:
                raise ValueError(f"{code} {c}:{v}: texto vazio")
            if "\\" in t:
                raise ValueError(f"{code} {c}:{v}: marcação residual: {t[:80]!r}")
            vi = vid(bnum, c, v)
            writer_rows["verse_text"].append({"cite_id": cite_txt(SOURCE_ID, vi), "vid": vi, "text": t})
        total += len(b["verses"])

        for c, v, t in b["heads"]:
            vi = vid(bnum, c, v)
            key = (vi, "heading")
            if key in seen_div:
                # Mais de um título antes do mesmo versículo: junta-os na mesma linha.
                for r in writer_rows["text_division"]:
                    if r["vid"] == vi and r["kind"] == "heading":
                        r["title"] = f"{r['title']} {t}"
                continue
            seen_div.add(key)
            writer_rows["text_division"].append({"vid": vi, "kind": "heading", "title": t})
        for c, v in b["paras"]:
            vi = vid(bnum, c, v)
            key = (vi, "paragraph")
            if key in seen_div:
                continue
            seen_div.add(key)
            writer_rows["text_division"].append({"vid": vi, "kind": "paragraph", "title": None})

    if len(seen_books) != 66:
        raise ValueError(f"esperados 66 livros, encontrados {len(seen_books)}")
    if chapters != EXPECTED_CHAPTERS or total != EXPECTED_VERSES:
        raise ValueError(f"contagem inesperada: {chapters} capítulos, {total} versículos")

    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="text",
            title="Bíblia Livre",
            author="Diego Santos, Mario Sérgio, Marco Teles",
            lang="pt",
            license="CC-BY-3.0-BR",
            license_url="http://creativecommons.org/licenses/by/3.0/br/",
            url="https://ebible.org/find/details.php?id=porbr2018",
            version=("porbr2018 (eBible USFM, fontes de 12/12/2025, HTML gerado em 08/10/2026); "
                     "repositório blivre/BibliaLivre, LICENCA.md"),
            attribution=("Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), "
                         "Copyright © Diego Santos, Mario Sérgio, e Marco Teles, "
                         "http://sites.google.com/site/biblialivre/ - fevereiro de 2018. "
                         "Licença Creative Commons Atribuição 3.0 Brasil "
                         "(http://creativecommons.org/licenses/by/3.0/br/). "
                         "Reprodução permitida desde que devidamente mencionados fonte e autores."),
            notes=("Tradução de João Ferreira de Almeida (1819), atualizada; NT a partir do texto "
                   "Textus Receptus (variante 'tr' do projeto). eBible.org indica CC BY 4.0 Brasil "
                   "no seu aviso, mas a LICENCA.md do projeto diz 3.0; ambas exigem atribuição. "
                   "Versificação KJV. Notas de rodapé, referências cruzadas e títulos de citação "
                   "removidos do texto. Títulos dos Salmos (\\d) gravados como heading."),
        )
        for r in writer_rows["verse_text"]:
            w.row("verse_text", **r)
        for r in writer_rows["text_division"]:
            w.row("text_division", **r)
    print(f"{total} versículos, {chapters} capítulos, {len(seen_books)} livros")


if __name__ == "__main__":
    main()
