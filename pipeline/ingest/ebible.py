"""Ingestor genérico: Bíblia do eBible.org em USFM, só os 66 livros protestantes.

Uma Bíblia por vez (ou várias). Cada uma vem de uma linha de pipeline/bibles/catalog.tsv (coluna `ebible` =
código do eBible, ex.: engbsb). O zip USFM é baixado para data/raw/bibles/<id>/ (uma vez) e o texto vai para
data/staging/bibles/<id>/ (verse_text.jsonl, text_division.jsonl, source.json, books.json).

Lê \\id (código do livro), \\c e \\v (versículos), \\s/\\ms/\\d (títulos; \\d é o título do salmo),
\\p/\\m/\\pmo... (início de parágrafo) e \\toc1/\\toc2/\\toc3 (nomes do livro). Notas (\\f, \\fe, \\x),
referências cruzadas e paralelas (\\r), figuras e marcação de Strong (\\w palavra|strong="..."\\w*) saem do texto.

A versificação NÃO é corrigida aqui: o staging guarda o que a tradução numera. A comparação com a KJV e os
mapeamentos aprovados ficam em pipeline/bibles/versification.py, aplicados por pipeline/package_bibles.py.

Uso (a partir da raiz do repositório):
    python3 pipeline/ingest/ebible.py engbsb
    python3 pipeline/ingest/ebible.py --all          (todas as linhas do catálogo com `ebible` preenchido)
"""

import argparse
import csv
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.refs import BOOK_BY_NUM, book_num, vid  # noqa: E402
from sensus.staging import RAW, StagingWriter  # noqa: E402

CATALOG = Path(__file__).resolve().parents[1] / "bibles" / "catalog.tsv"
FOLDER = "bibles"
URL_BASE = "https://eBible.org/Scriptures/{code}_usfm.zip"
PAGE_BASE = "https://ebible.org/find/details.php?id={code}"

# Deuterocanônicos e livros de outras tradições: ignorados (o app é só com o cânon protestante).
NOT_PROTESTANT = {
    "TOB", "JDT", "ESG", "WIS", "SIR", "BAR", "LJE", "S3Y", "SUS", "BEL", "DAN_GR",
    "1MA", "2MA", "3MA", "4MA", "1ES", "2ES", "MAN", "PS2", "PS3", "DAG", "PSS", "EZA", "5EZ", "6EZ", "LAO",
    "ODA", "PRA", "JAS_GR", "1MC", "2MC",
}

# Material que não é livro (página de rosto, glossário, introdução): ignorado.
NOT_BOOK = {"FRT", "INT", "GLO", "BAK", "OTH", "CNC", "TDX", "NDX", "XXA", "XXB", "XXC", "XXD", "XXE", "XXF", "XXG"}

RE_ID = re.compile(r"^\\id\s+(\S+)")
RE_TOC = re.compile(r"^\\toc([123])\s+(.*)$")
RE_CHAPTER = re.compile(r"^\\c\s+(\d+)\s*$")
RE_VERSE = re.compile(r"^\\v\s+(\d+)(?:-\d+)?(?:\s|$)(.*)$")
RE_HEADING = re.compile(r"^\\(?:ms\d?|s\d?|d)(?:\s+(.*))?$")  # \s, \s1, \ms, \d (título do salmo)
RE_PARA = re.compile(r"^\\(?:p|m|pmo|pm|pmc|pmr|pi\d?|mi|nb)(?:\s+(.*))?$")
RE_LINE_MARKER = re.compile(r"^\\([a-zA-Z0-9]+)")
# Linhas que não trazem texto de versículo nem início de parágrafo.
IGNORED = {
    "id", "ide", "h", "h1", "h2", "h3", "toc1", "toc2", "toc3", "mt", "mt1", "mt2", "mt3", "mte", "mte1",
    "mte2", "imt", "imt1", "imt2", "is", "is1", "is2", "ip", "ipi", "im", "ie", "iot", "io", "io1", "io2",
    "ior", "iq", "iq1", "iq2", "ib", "r", "mr", "sr", "cl", "cp", "cd", "sp", "rem", "usfm", "lit", "b",
}


def clean(s: str) -> str:
    """Remove notas, referências, figuras e marcação USFM; devolve texto puro em uma linha."""
    s = re.sub(r"\\(f|fe|x|fig|rq|ef|ex)\s.*?\\\1\*", " ", s, flags=re.S)  # notas, referências, figuras
    s = re.sub(r"\\(va|vp|ca|cp)\s.*?\\\1\*", " ", s, flags=re.S)           # números alternativos
    s = re.sub(r"\|(?:[A-Za-z][\w-]*=\"[^\"]*\"\s*)+", "", s)              # atributos de \w (Strong, lema)
    s = re.sub(r"\\\+?w\s+", "", s)                                          # abertura de \w
    s = re.sub(r"\\\+?[a-zA-Z0-9]+\*", "", s)                                # fechamento (\add*, \w*)
    s = re.sub(r"\\\+?[a-zA-Z0-9]+", " ", s)                                 # aberturas (\add, \nd, \q2...)
    s = s.replace("\u00a0", " ")
    return re.sub(r"\s+", " ", s).strip()


def split_verse_markers(raw: str) -> list[str]:
    """Separa linhas em que \\v aparece no meio (ex.: '\\q1 \\v 5 texto'). Devolve linhas já limpas de espaço."""
    raw = re.sub(r"\s*(\\v\s)", r"\n\1", raw)
    return [ln.strip() for ln in raw.split("\n") if ln.strip()]


def parse_usfm(text: str) -> dict:
    """Converte um livro USFM em versículos, títulos e inícios de parágrafo.

    Títulos e parágrafos vão para o primeiro versículo que vem depois deles.
    Retorna {code, names: {toc1,toc2,toc3}, verses: [(cap, vers, texto)], heads: [(cap, vers, título)],
             paras: [(cap, vers)], ranges: [(cap, vers, fim)]}.
    """
    out = {"code": None, "names": {}, "verses": [], "heads": [], "paras": [], "ranges": []}
    chap = None
    cur = None          # (cap, vers) do versículo em andamento
    buf: list[str] = []
    pend_heads: list[str] = []
    pend_para = False

    def close_verse():
        if cur is not None:
            out["verses"].append((cur[0], cur[1], clean(" ".join(buf))))

    lines = []
    for raw in text.splitlines():
        lines.extend(split_verse_markers(raw))

    for line in lines:
        if m := RE_ID.match(line):
            out["code"] = m.group(1)
            continue

        if m := RE_TOC.match(line):
            out["names"]["toc" + m.group(1)] = clean(m.group(2))
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
            num = int(m.group(1))
            if re.match(r"^\\v\s+\d+-\d+", line):
                out["ranges"].append((chap, num, line.split()[1]))
            cur = (chap, num)
            buf = [m.group(2)]
            for t in pend_heads:
                out["heads"].append((cur[0], cur[1], t))
            if pend_para:
                out["paras"].append(cur)
            pend_heads, pend_para = [], False
            continue

        if m := RE_HEADING.match(line):
            t = clean(m.group(1) or "")
            if t:
                pend_heads.append(t)
            continue

        if m := RE_PARA.match(line):
            pend_para = True
            rest = m.group(1)
            if rest and cur is not None:  # texto na mesma linha do marcador de parágrafo
                buf.append(rest)
            continue

        marker = RE_LINE_MARKER.match(line)
        if marker and marker.group(1) in IGNORED:
            continue
        if cur is not None:
            buf.append(line)  # continuação do versículo (inclui marcadores de poesia e de texto)

    close_verse()
    return out


def fetch(url: str, dest: Path) -> None:
    """Baixa url para dest, só se ainda não existir (idempotente)."""
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "sensus-ingest/1.0"})
    tmp = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        f.write(r.read())
    tmp.rename(dest)


def load_catalog() -> list[dict]:
    with open(CATALOG, encoding="utf-8") as f:
        return [row for row in csv.DictReader(f, delimiter="\t") if row["id"] and not row["id"].startswith("#")]


def ingest(entry: dict) -> dict:
    """Baixa, lê e grava o staging de uma Bíblia. Devolve um resumo (contagens e problemas)."""
    bid, code = entry["id"], entry["ebible"]
    raw_dir = RAW / FOLDER / bid
    zip_path = raw_dir / f"{code}_usfm.zip"
    fetch(URL_BASE.format(code=code), zip_path)
    if not zipfile.is_zipfile(zip_path):
        raise RuntimeError(f"{bid}: arquivo não é um zip válido: {zip_path}")

    books = []
    skipped = []
    with zipfile.ZipFile(zip_path) as z:
        for name in sorted(n for n in z.namelist() if n.lower().endswith(".usfm")):
            # Conteúdo é só lido como texto; nada é extraído nem executado.
            parsed = parse_usfm(z.read(name).decode("utf-8-sig"))
            if parsed["code"] in NOT_PROTESTANT or parsed["code"] in NOT_BOOK:
                skipped.append(parsed["code"])
                continue
            books.append(parsed)

    verse_rows, div_rows, book_rows = [], [], []
    seen = set()
    problems = []
    seen_div = set()
    for b in books:
        bnum = book_num(b["code"])
        if bnum in seen:
            raise ValueError(f"{bid}: livro duplicado: {b['code']}")
        seen.add(bnum)
        meta = BOOK_BY_NUM[bnum]
        names = b["names"]
        # Nome de citação = \toc2 (curto). Abreviação = \toc3 se for curta; senão a sigla padrão do livro.
        name = names.get("toc2") or names.get("toc1") or meta[2]
        short = name
        toc3 = names.get("toc3", "")
        abbr = toc3 if toc3 and len(toc3) <= 6 else meta[6].split()[0]
        book_rows.append({"book": bnum, "name": name, "short": short, "abbr": abbr, "usfm": b["code"]})
        for c, v, t in b["verses"]:
            vi = vid(bnum, c, v)
            if not t:
                problems.append(f"{b['code']} {c}:{v} vazio")
            verse_rows.append({"vid": vi, "text": t})
        for c, v, end in b["ranges"]:
            problems.append(f"{b['code']} {c}:{v} faixa de versículos ({end})")
        for c, v, t in b["heads"]:
            vi = vid(bnum, c, v)
            key = (vi, "heading")
            if key in seen_div:
                for r in div_rows:
                    if r["vid"] == vi and r["kind"] == "heading":
                        r["title"] = f"{r['title']} {t}"
                continue
            seen_div.add(key)
            div_rows.append({"vid": vi, "kind": "heading", "title": t})
        for c, v in b["paras"]:
            vi = vid(bnum, c, v)
            key = (vi, "paragraph")
            if key in seen_div:
                continue
            seen_div.add(key)
            div_rows.append({"vid": vi, "kind": "paragraph", "title": None})

    # Não exige os 66 livros: uma Bíblia parcial é gravada e reprovada depois, em pipeline/package_bibles.py.
    seen_vids = set()
    for r in verse_rows:
        if r["vid"] in seen_vids:
            raise ValueError(f"{bid}: versículo duplicado {r['vid']}")
        seen_vids.add(r["vid"])

    with StagingWriter(bid, folder=FOLDER) as w:
        w.source(
            kind="text",
            title=entry["name"],
            lang=entry["lang"],
            license=entry["license"],
            license_url=entry["license_url"] or None,
            url=PAGE_BASE.format(code=code),
            version=f"eBible.org {code}_usfm.zip (USFM)",
            attribution=entry["attribution"],
            notes=f"Gerado por pipeline/ingest/ebible.py a partir de {URL_BASE.format(code=code)}.",
        )
        for r in verse_rows:
            w.row("verse_text", cite_id=f"txt:{bid}:{r['vid']}", **r)
        for r in div_rows:
            w.row("text_division", **r)
    (w.dir / "books.json").write_text(json.dumps(book_rows, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"id": bid, "books": len(books), "verses": len(verse_rows), "skipped": skipped, "problems": problems}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("ids", nargs="*", help="ids do catálogo (ex.: engbsb)")
    ap.add_argument("--all", action="store_true", help="todas as linhas do catálogo com ebible preenchido")
    args = ap.parse_args()
    catalog = [e for e in load_catalog() if e["ebible"]]
    if args.all:
        chosen = catalog
    else:
        by_id = {e["id"]: e for e in catalog}
        missing = [i for i in args.ids if i not in by_id]
        if missing:
            ap.error(f"fora do catálogo ou sem código eBible: {missing}")
        chosen = [by_id[i] for i in args.ids]
    for entry in chosen:
        res = ingest(entry)
        print(f"{res['id']}: {res['books']} livros, {res['verses']} versículos"
              + (f", ignorados {res['skipped']}" if res["skipped"] else ""))
        for p in res["problems"][:20]:
            print(f"  aviso: {p}")
        if len(res["problems"]) > 20:
            print(f"  ... mais {len(res['problems']) - 20} avisos")


if __name__ == "__main__":
    main()
