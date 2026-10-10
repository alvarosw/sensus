"""Ingestor 'patristic': comentários dos Pais da Igreja, indexados por versículo.

Origem: github.com/HistoricalChristianFaith/Commentaries-Database @ COMMIT (fixado).

Licenciamento (crítico): o repositório NÃO licencia o conteúdo como um todo.
Seu LICENSE dedica ao domínio público a compilação e declara que vários trechos
são de obras protegidas, incluídos sob "uso justo", sem cessão de direitos.
Por isso um trecho só entra se o seu TEXTO aparece em uma edição em domínio
público, independentemente da URL que o repositório cita:
  - corpus PD = páginas de /fathers/ do New Advent (ANF/NPNF, ed. Philip Schaff,
    1885-1900), listadas no sitemap, que contenham a citação da edição Schaff/
    Gifford/Pusey etc.; mais as páginas PD já vetadas (CCEL/Tertullian.org) que
    o próprio repositório cita;
  - o trecho (>= 12 palavras) precisa aparecer literalmente na página: >= 90% dos
    6-gramas, ou >= 80% com ambas as pontas presentes.
Excluídos: trechos sem prova no corpus PD; e o arquivo de Jerônimo sobre Daniel,
que é a tradução de Gleason Archer (1958) transcrita por Roger Pearse, com
comentários de Archer e Pearse não pode provar domínio público.

Escopo: Pais da Igreja — autores com data <= 750 d.C. (metadata.toml), fora das
categorias canônica/apócrifa/pseudepígrafa/conciliar/litúrgica/reforma, sem
autoria pseudônima e sem autores marcados como condenados por concílio.
Livros: cânon protestante de refs.py (livros deuterocanônicos são descartados).

Uso:
    cd pipeline && .venv/bin/python -I ingest/patristic.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import hashlib  # noqa: E402
import html  # noqa: E402
import json  # noqa: E402
import re  # noqa: E402
import shutil  # noqa: E402
import tarfile  # noqa: E402
import time  # noqa: E402
import tomllib  # noqa: E402
import urllib.request  # noqa: E402
from collections import Counter  # noqa: E402
from concurrent.futures import ThreadPoolExecutor  # noqa: E402
from urllib.parse import urlsplit  # noqa: E402

from sensus.refs import book_num, vid  # noqa: E402
from sensus.staging import RAW, StagingWriter, cite_com  # noqa: E402

SOURCE_ID = "patristic"
REPO = "HistoricalChristianFaith/Commentaries-Database"
COMMIT = "8e8082b5f541e7e4105f48692f973956caa72dcd"  # master em 2026-09-22
TARBALL_URL = f"https://codeload.github.com/{REPO}/tar.gz/{COMMIT}"
TARBALL_SHA256 = "99546864588bad9df18a4fc07ab0d0e3527f0f7cf4b4896b480878d1cb6c350b"
REPO_URL = f"https://github.com/{REPO}/tree/{COMMIT}"
SITEMAP_URL = "https://www.newadvent.org/sitemap.xml"
UA = "Mozilla/5.0 (sensus-ingest; local research pipeline)"

RAW_DIR = RAW / SOURCE_ID
TARBALL = RAW_DIR / f"{COMMIT}.tar.gz"
SRC = RAW_DIR / "src"
PAGES = RAW_DIR / "pages"
SITEMAP = RAW_DIR / "newadvent-sitemap.xml"
MANIFEST = RAW_DIR / "manifest.json"

MAX_YEAR = 750
EXCLUDED_CATEGORIES = {
    "Canonical Scriptures",
    "Apocrypha, Pseudepigrapha & Early Documents",
    "Second Temple Judaism",
    "Pseudonymous Works",
    "Reformation & Modern",
    "Councils & Canons",
    "Liturgies & Hymns",
}
# Hosts cujas páginas citadas são edições PD (vetadas à mão).
PD_HOSTS = {"newadvent.org", "ccel.org", "tertullian.org"}
# Caminhos PD-host que NÃO são PD (ver topo do arquivo).
EXCLUDED_PATHS = ("/pearse/morefathers/files/jerome_daniel",)
# Páginas citadas sem nenhuma atribuição de tradução/edição: não há como provar PD.
UNVERIFIED_PATHS = ("/ccel/cassian/conferences",)
# Marca de edição PD exigida em páginas do New Advent antes de entrarem no corpus.
NOTICE_RE = re.compile(r"Schaff|Ante-Nicene|Nicene and Post-Nicene|Christian Literature Publishing|"
                       r"Gifford|Pusey|Payne Smith")
NA_FATHERS_RE = re.compile(r"<loc>(https://www\.newadvent\.org/fathers/\d+\.htm)</loc>")

FILE_RE = re.compile(r"(\d+)_(\d+)(?:-(?:(\d+)_)?(\d+))?")
WORD = re.compile(r"[^\W_]+")
SHINGLE = 6
MIN_WORDS = 12


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def strip_url(u: str) -> str:
    return re.sub(r"#.*$", "", u)


def page_key(url: str) -> str:
    return hashlib.sha1(strip_url(url).encode()).hexdigest() + ".html"


def fetch(url: str, dest: Path, retries: int = 3) -> bool:
    """Baixa url para dest (idempotente: não rebaixa se já existe)."""
    if dest.exists() and dest.stat().st_size > 0:
        return True
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            tmp = dest.with_name(dest.name + ".part")
            tmp.write_bytes(data)
            tmp.replace(dest)
            return True
        except Exception as e:  # rede: tenta de novo
            last = e
            time.sleep(2 + 3 * attempt)
    print(f"  falha ao baixar {url}: {last}")
    return False


def ensure_tarball() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if not (TARBALL.exists() and sha256_of(TARBALL) == TARBALL_SHA256):
        tmp = TARBALL.with_name(TARBALL.name + ".part")
        req = urllib.request.Request(TARBALL_URL, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
            shutil.copyfileobj(r, f)
        if sha256_of(tmp) != TARBALL_SHA256:
            tmp.unlink()
            raise RuntimeError("sha256 do tarball não confere com o commit fixado")
        tmp.replace(TARBALL)


def ensure_extracted() -> None:
    if SRC.exists():
        return
    tmp = RAW_DIR / "_extract"
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    with tarfile.open(TARBALL) as t:
        t.extractall(tmp, filter="data")
    top = [p for p in tmp.iterdir() if p.is_dir()]
    if len(top) != 1:
        raise RuntimeError("estrutura inesperada no tarball")
    top[0].rename(SRC)
    shutil.rmtree(tmp)


def strip_html(s: str) -> str:
    s = re.sub(r"<script.*?</script>|<style.*?</style>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return html.unescape(s)


def words(s: str) -> list[str]:
    return WORD.findall(s.lower())


def grams(ws: list[str]) -> set:
    return {tuple(ws[i:i + SHINGLE]) for i in range(len(ws) - SHINGLE + 1)}


def clean_quote(q: str) -> str:
    """Texto puro, parágrafos separados por linha em branco (\\n\\n)."""
    q = html.unescape(re.sub(r"<[^>]+>", " ", q))
    paras = [" ".join(p.split()) for p in re.split(r"\n\s*\n", q.strip())]
    return "\n\n".join(p for p in paras if p)


def in_scope_father(father: str, meta: dict) -> bool:
    m = meta.get(father)
    if m is None or father.startswith("Pseudo"):
        return False
    if m.get("condemned_by_council") or m.get("father_category") in EXCLUDED_CATEGORIES:
        return False
    return m.get("default_year", 9999) <= MAX_YEAR


def parse_file(stem: str):
    """'Philippians 2_5-6' -> (start_vid, end_vid) ou None."""
    name, _, rng = stem.rpartition(" ")
    m = FILE_RE.fullmatch(rng)
    if not m:
        return None
    try:
        b = book_num(name)
    except KeyError:
        return None
    c1, v1, c2, v2 = m.group(1), m.group(2), m.group(3), m.group(4)
    if v2 is None:  # 'c_v'
        c2, v2 = c1, v1
    elif c2 is None:  # 'c_v1-v2'
        c2 = c1
    start, end = vid(b, int(c1), int(v1)), vid(b, int(c2), int(v2))
    if end < start:
        return None
    return start, end


def load_candidates(stats: Counter) -> list[dict]:
    meta = {}
    for p in SRC.rglob("metadata.toml"):
        meta[p.parent.name] = tomllib.loads(p.read_text(encoding="utf-8"))
    cands = []
    for p in sorted(SRC.rglob("*.toml")):
        if p.name == "metadata.toml":
            continue
        father = p.parent.name
        if not in_scope_father(father, meta):
            stats["arquivos fora do escopo (autor/categoria)"] += 1
            continue
        parsed = parse_file(p.stem)
        if parsed is None:
            stats["arquivos com livro/referência fora do cânon de refs.py (ex.: deuterocanônicos)"] += 1
            continue
        start, end = parsed
        data = tomllib.loads(p.read_text(encoding="utf-8"))
        for i, c in enumerate(data.get("commentary", [])):
            stats["entradas no escopo"] += 1
            url = c.get("source_url", "") or ""
            if any(x in url for x in EXCLUDED_PATHS):
                stats["excluído: tradução de Archer (Jerônimo, Daniel)"] += 1
                continue
            if any(x in url for x in UNVERIFIED_PATHS):
                stats["excluído: página sem atribuição de tradução"] += 1
                continue
            body = clean_quote(c.get("quote", ""))
            ws = words(body)
            if len(ws) < MIN_WORDS:
                stats[f"excluído: trecho com menos de {MIN_WORDS} palavras"] += 1
                continue
            cands.append(dict(father=father, file=p.name, idx=i, start=start, end=end,
                              body=body, ws=ws, url=url,
                              title=c.get("source_title", "") or "",
                              app=c.get("append_to_author_name", "") or ""))
    return cands


def load_corpus(stats: Counter, cited_urls: set[str]) -> list[str]:
    """URLs do corpus PD: New Advent /fathers/ (com marca de edição) + páginas citadas PD."""
    if not SITEMAP.exists():
        fetch(SITEMAP_URL, SITEMAP)
    na = sorted(set(NA_FATHERS_RE.findall(SITEMAP.read_text(encoding="utf-8"))))
    stats["páginas New Advent /fathers/ no sitemap"] = len(na)
    cited = sorted(u for u in cited_urls if not any(x in u for x in EXCLUDED_PATHS + UNVERIFIED_PATHS))
    return sorted(set(na) | set(cited))


def main() -> None:
    ensure_tarball()
    ensure_extracted()
    PAGES.mkdir(parents=True, exist_ok=True)
    stats: Counter = Counter()

    cands = load_candidates(stats)
    cited = {strip_url(c["url"]) for c in cands if urlsplit(c["url"]).netloc.lower().removeprefix("www.") in PD_HOSTS}
    corpus_urls = load_corpus(stats, cited)
    print(f"candidatos: {len(cands)}; páginas no corpus: {len(corpus_urls)}")

    # Baixa o corpus (idempotente, em paralelo moderado).
    with ThreadPoolExecutor(max_workers=4) as ex:
        okflags = list(ex.map(lambda u: fetch(u, PAGES / page_key(u)), corpus_urls))
    stats["páginas não obtidas"] = okflags.count(False)

    # Índice de âncoras: 6-gramas de posições espalhadas de cada candidato.
    anchors: dict = {}
    for i, c in enumerate(cands):
        ws, n = c["ws"], len(c["ws"])
        for pos in sorted({0, n // 4, n // 2, (3 * n) // 4, n - SHINGLE}):
            g = tuple(ws[pos:pos + SHINGLE])
            anchors.setdefault(g, []).append(i)
    anchor_set = set(anchors)

    best: dict[int, tuple[float, str]] = {}
    for u in corpus_urls:  # ordem determinística
        p = PAGES / page_key(u)
        if not p.exists() or p.stat().st_size == 0:
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        is_na = "newadvent.org" in u
        if is_na and not NOTICE_RE.search(text):
            stats["páginas New Advent sem marca de edição PD (ignoradas)"] += 1
            continue
        pg = grams(words(strip_html(text)))
        for g in pg & anchor_set:
            for i in anchors[g]:
                ws = cands[i]["ws"]
                qg = [tuple(ws[j:j + SHINGLE]) for j in range(len(ws) - SHINGLE + 1)]
                frac = sum(x in pg for x in qg) / len(qg)
                anchored = qg[0] in pg and qg[-1] in pg
                if frac >= 0.9 or (frac >= 0.8 and anchored):
                    if i not in best or frac > best[i][0]:
                        best[i] = (round(frac, 3), u)

    kept = []
    for i, c in enumerate(cands):
        if i not in best:
            stats["excluído: trecho não encontrado em edição PD"] += 1
            continue
        c["frac"], c["pd_page"] = best[i]
        kept.append(c)
        stats["verificado em edição PD"] += 1

    # Ordem determinística para cite_id estável (.2, .3 nos repetidos).
    kept.sort(key=lambda c: (c["start"], c["end"], c["father"], c["file"], c["idx"]))
    seen: Counter = Counter()
    rows, manifest = [], []
    for c in kept:
        base = cite_com(SOURCE_ID, c["start"], c["end"])
        seen[base] += 1
        cite = base if seen[base] == 1 else f"{base}.{seen[base]}"
        who = c["father"] + (f" {c['app'].strip()}" if c["app"].strip() else "")
        head = f"{who} — {c['title'].strip()}" if c["title"].strip() else who
        rows.append(dict(cite_id=cite, start_vid=c["start"], end_vid=c["end"],
                         text=f"{head}\n\n{c['body']}"))
        manifest.append(dict(cite_id=cite, father=c["father"], file=c["file"], idx=c["idx"],
                             cited_url=c["url"], pd_page=c["pd_page"], frac=c["frac"]))

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=0))

    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="commentary",
            title="Church Fathers commentary by verse (public-domain subset)",
            author="Various (Church Fathers)",
            lang="en",
            license="Public Domain",
            license_url=None,
            url=REPO_URL,
            version=COMMIT,
            attribution=(
                "Trechos de traduções em domínio público (Ante-Nicene e Nicene and "
                "Post-Nicene Fathers, ed. Philip Schaff; Gifford; Pusey; Payne Smith; "
                "Gardner; Edgecomb), via New Advent, CCEL e Tertullian.org. "
                f"Seleção e indexação por versículo: {REPO} @ {COMMIT[:7]}."
            ),
            tradition="patristic",
            notes=(
                "Subconjunto verificado do Commentaries-Database. O repositório como um todo "
                "NÃO é licenciado para redistribuição (LICENSE mistura compilação em domínio "
                "público com excertos de obras protegidas sob uso justo). Cada trecho aqui "
                "aparece literalmente em edição PD (New Advent/CCEL/Tertullian.org), "
                "independentemente da URL citada pelo repositório. Escopo: Pais da Igreja "
                "até c. 750 d.C., cânon protestante."
            ),
        )
        for r in rows:
            w.row("commentary", **r)

    for k, v in sorted(stats.items()):
        if v:
            print(f"  {k}: {v}")
    print(f"linhas gravadas: {len(rows)}; manifesto: {MANIFEST}")


if __name__ == "__main__":
    main()
