"""Empacota as Bíblias do repositório de Bíblias: um SQLite por Bíblia, zip para o GitHub Releases e manifesto.

Contrato: docs/design/idiomas-biblias-fontes.md, §2 (Repositório de Bíblias). Cada pacote tem o esquema lógico
meta / verse_text / text_division / book_name. A lista e os metadados vêm de pipeline/bibles/catalog.tsv; o
texto vem do staging (data/staging/bibles/<id>/, feito por pipeline/ingest/ebible.py).

Antes de empacotar, cada Bíblia é alinhada à KJV pela TVTMS (pipeline/bibles/tvtms.py: numeração das tradições
hebraica, latina e grega; títulos de salmo viram cabeçalho do v.1) e comparada com a KJV
(pipeline/bibles/versification.py, com as 16 omissões do texto crítico fora da conta). Abaixo de 99,5% dos
capítulos com a mesma contagem de versículos, o empacotamento para com erro: a Bíblia sai do catálogo.

Saídas:
    ../dist/bibles/bible-<id>-<versão>.zip   ZIP com deflate e uma entrada: bible-<id>.db (não vai para o git)
    ../bibles-manifest.json                  catálogo lido pelo app (raiz do repositório)

Uso (a partir de pipeline/):
    python3 package_bibles.py [--version 2026.11.06] [--only engwebp,frasbl] [--samples]
"""

import argparse
import csv
import hashlib
import json
import sqlite3
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent
sys.path.insert(0, str(PIPELINE))
sys.path.insert(0, str(PIPELINE / "bibles"))

import tvtms as TV  # noqa: E402
import versification as V  # noqa: E402
from sensus.staging import ROOT, STAGING  # noqa: E402

CATALOG = PIPELINE / "bibles" / "catalog.tsv"
MANIFEST = ROOT / "bibles-manifest.json"
DIST = ROOT / "dist" / "bibles"
GITHUB_REPO = "alvarosw/sensus"
SCHEMA_VERSION = 1
# Crédito exigido pela CC BY 4.0 da TVTMS para Bíblias cuja numeração foi alinhada por ela (ver tvtms.py).
TVTMS_CREDITO = ("Numeração alinhada à KJV com a TVTMS (Translators Versification Traditions with Methodology for "
                 "Standardisation), STEP Bible (www.STEPBible.org), baseada em trabalho da Tyndale House, Cambridge; "
                 "licença CC BY 4.0.")
CATALOG_VERSION = "2026.11.06"
ENTRY_PREFIX = "bible-"
# Amostras do critério de conferência (versículo, esperado no início do texto em inglês ou no original da Bíblia).
# Origem das Bíblias que já estão no banco principal (ingestores blivre.py e sword_kjv.py).
BUNDLED_URLS = {
    "blivre": "https://ebible.org/find/details.php?id=porbr2018",
    "kjv": "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/KJV.zip",
}
SAMPLES = [("Jo 3:16", 43003016), ("Sl 23:1", 19023001), ("Sl 51:1", 19051001), ("Dn 8:14", 27008014)]

SCHEMA_SQL = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- cite_id: a mesma coluna de pipeline/schema.sql. VERSE_COLS (packages/core/src/repo/sql.ts) a seleciona,
-- então o pacote precisa dela para as consultas de texto do núcleo rodarem sem mudança.
CREATE TABLE verse_text (cite_id TEXT NOT NULL, source_id TEXT NOT NULL, vid INTEGER NOT NULL, text TEXT NOT NULL,
                         PRIMARY KEY (source_id, vid));
CREATE UNIQUE INDEX verse_text_cite ON verse_text (cite_id);
CREATE TABLE text_division (source_id TEXT NOT NULL, vid INTEGER NOT NULL, kind TEXT NOT NULL, title TEXT,
                            PRIMARY KEY (source_id, vid, kind));
CREATE TABLE book_name (book INTEGER PRIMARY KEY, name TEXT NOT NULL, short TEXT, abbr TEXT);
"""


def load_catalog(path: Path = CATALOG) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def load_jsonl(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def build_sqlite(db_path: Path, *, bible_id: str, version: str, lang: str, license_: str, attribution: str,
                 verses: dict[int, str], divisions: list[dict], books: list[dict], built_at: str) -> None:
    """Grava o SQLite no contrato. Versículo sem texto não entra (o app mostra a lacuna, não uma linha vazia)."""
    if db_path.exists():
        db_path.unlink()
    con = sqlite3.connect(db_path)
    try:
        con.executescript(SCHEMA_SQL)
        meta = {"bible_id": bible_id, "version": version, "lang": lang, "schema_version": str(SCHEMA_VERSION),
                "built_at": built_at, "license": license_, "attribution": attribution}
        con.executemany("INSERT INTO meta (key, value) VALUES (?, ?)", list(meta.items()))
        written = {vid: text for vid, text in verses.items() if text.strip()}
        con.executemany(
            "INSERT INTO verse_text (cite_id, source_id, vid, text) VALUES (?, ?, ?, ?)",
            [(f"txt:{bible_id}:{vid}", bible_id, vid, text) for vid, text in sorted(written.items())],
        )
        con.executemany(
            "INSERT INTO text_division (source_id, vid, kind, title) VALUES (?, ?, ?, ?)",
            [(bible_id, d["vid"], d["kind"], d.get("title")) for d in divisions if d["vid"] in written],
        )
        con.executemany(
            "INSERT INTO book_name (book, name, short, abbr) VALUES (?, ?, ?, ?)",
            [(b["book"], b["name"], b["short"], b["abbr"]) for b in sorted(books, key=lambda b: b["book"])],
        )
        con.commit()
    finally:
        con.close()


def write_zip(db_path: Path, zip_path: Path) -> None:
    """ZIP com deflate e uma única entrada (o nome do banco). Confere CRC e tamanho depois de escrito."""
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    part = zip_path.with_name(zip_path.name + ".part")
    with zipfile.ZipFile(part, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.write(db_path, arcname=db_path.name)
    with zipfile.ZipFile(part) as z:
        names = z.namelist()
        if names != [db_path.name]:
            raise RuntimeError(f"zip com entradas inesperadas: {names}")
        if z.testzip() is not None:
            raise RuntimeError(f"CRC inválido em {part}")
        if z.getinfo(db_path.name).file_size != db_path.stat().st_size:
            raise RuntimeError("tamanho descompactado diferente do banco")
    part.replace(zip_path)


def package_entry(bible_id: str, version: str) -> dict:
    """Bloco `package` do manifesto (URL da release, sha256 e tamanhos). Preenchido depois de gerar o zip."""
    zip_name = f"{ENTRY_PREFIX}{bible_id}-{version}.zip"
    return {"url": f"https://github.com/{GITHUB_REPO}/releases/download/bibles-{version}/{zip_name}"}


def manifest_for(entries: list[dict], version: str) -> dict:
    """Manifesto no formato do contrato. Entradas `bundled` não têm package."""
    return {"catalog_version": version, "schema_version": SCHEMA_VERSION, "bibles": entries}


def check_versification(bible_id: str, kjv: dict[int, str], index: dict) -> dict:
    """Alinha a Bíblia à KJV (TVTMS) e compara a contagem. Levanta erro se não atingir o limiar.

    Devolve os versículos já na numeração KJV, as divisões reencaminhadas (bridge, paragraph) e os títulos
    (heading) de cada versículo KJV. Títulos e divisões de vid que cai fora da numeração não são gravados.
    """
    base = STAGING / "bibles" / bible_id
    verses = {r["vid"]: r["text"] for r in load_jsonl(base / "verse_text.jsonl")}
    divs = load_jsonl(base / "text_division.jsonl")
    heads: dict[int, str] = {}
    for d in divs:
        if d["kind"] == "heading" and d.get("title"):
            heads[d["vid"]] = f"{heads[d['vid']]} {d['title']}" if d["vid"] in heads else d["title"]
    overrides, _ = TV.title_as_verse(verses, heads, kjv, index, frozenset(kjv))
    res = TV.reversify(verses, heads, index, frozenset(kjv), overrides)
    report = V.compare(res.numbered, kjv)
    if not V.passes(report):
        pct = 100 * report["match"] / max(report["chapters"], 1)
        raise RuntimeError(
            f"{bible_id}: {report['match']}/{report['chapters']} capítulos ({pct:.2f}%) com a contagem da KJV; "
            f"mínimo {100 * V.LIMIAR_CAPITULOS:.1f}%. Diferenças: {report['bad'][:8]}"
        )
    out_divs, seen = [], set()
    for d in divs:
        if d["kind"] == "heading":
            continue
        vi = res.target.get(d["vid"], d["vid"])
        if vi not in res.numbered or (vi, d["kind"]) in seen:
            continue
        seen.add((vi, d["kind"]))
        out_divs.append({"vid": vi, "kind": d["kind"], "title": d.get("title")})
    lost_heads = 0
    for vi, title in sorted(res.heads.items()):
        if vi in res.numbered and title.strip():
            out_divs.append({"vid": vi, "kind": "heading", "title": title})
        else:
            lost_heads += 1
    return {"verses": res.numbered, "report": report, "divisions": out_divs, "applied": res.applied,
            "dropped": res.dropped, "lost_heads": lost_heads,
            # Checagens de texto e de título (informativas: acusam, não bloqueiam; ver versification.py).
            "text_findings": V.text_check(res.numbered, kjv), "title_findings": V.title_check(res.heads, kjv)}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--version", default=CATALOG_VERSION)
    ap.add_argument("--only", default="", help="ids separados por vírgula (padrão: todo o catálogo)")
    ap.add_argument("--samples", action="store_true", help="imprime Jo 3:16, Sl 23:1 e Dn 8:14 de cada pacote")
    args = ap.parse_args()

    only = {s for s in args.only.split(",") if s}
    kjv = {r["vid"]: r["text"] for r in load_jsonl(STAGING / "kjv" / "verse_text.jsonl")}
    index = TV.index_rules(TV.load_rules_file()[0])
    built_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    entries = []
    failures = []
    work = DIST / "work"
    work.mkdir(parents=True, exist_ok=True)

    for row in load_catalog():
        bid = row["id"]
        if only and bid not in only:
            continue
        entry = {
            "id": bid, "abbr": row["abbr"], "name": row["name"], "lang": row["lang"], "license": row["license"],
            "license_url": row["license_url"] or None, "attribution": row["attribution"],
            "url": None, "version": args.version, "testaments": ["OT", "NT"], "rank": int(row["rank"]),
        }
        if row["bundled"] == "1":
            entry["bundled"] = True
            entry["url"] = BUNDLED_URLS[bid]
            entries.append(entry)
            print(f"{bid}: no banco principal (bundled), sem pacote")
            continue
        try:
            checked = check_versification(bid, kjv, index)
            if any(a != "identidade" for a in checked["applied"]):
                entry["attribution"] = f"{row['attribution']} {TVTMS_CREDITO}"
            staging_dir = STAGING / "bibles" / bid
            source = json.loads((staging_dir / "source.json").read_text(encoding="utf-8"))
            books = json.loads((staging_dir / "books.json").read_text(encoding="utf-8"))
            divisions = checked["divisions"]
            db_path = work / f"bible-{bid}.db"
            build_sqlite(db_path, bible_id=bid, version=args.version, lang=row["lang"], license_=row["license"],
                         attribution=entry["attribution"], verses=checked["verses"], divisions=divisions,
                         books=books, built_at=built_at)
            zip_name = f"{ENTRY_PREFIX}{bid}-{args.version}.zip"
            zip_path = DIST / zip_name
            write_zip(db_path, zip_path)
            entry["url"] = source["url"]
            entry["package"] = {
                **package_entry(bid, args.version),
                "sha256": sha256_of(zip_path),
                "size": zip_path.stat().st_size,
                "uncompressed_size": db_path.stat().st_size,
            }
            entries.append(entry)
            rep = checked["report"]
            print(f"{bid}: {len(books)} livros, {len(checked['verses']) - len(rep['empty'])} versículos com texto "
                  f"({len(rep['empty'])} numerados sem texto), capítulos iguais à KJV "
                  f"{rep['match']}/{rep['chapters']}, zip {zip_path.stat().st_size / 1e6:.2f} MB")
            print(f"    TVTMS: {dict(checked['applied'].most_common(6))}; fora do cânon: {len(checked['dropped'])}; "
                  f"títulos sem versículo: {checked['lost_heads']}")
            tf, hf = checked["text_findings"], checked["title_findings"]
            print(f"    checagem de texto (Sl): {len(tf)} salmo(s) acusado(s) {[f['chapter'] for f in tf]}; "
                  f"título: {len(hf)} divergência(s) {[f['chapter'] for f in hf][:12]}")
            if args.samples:
                titles = {d["vid"]: d["title"] for d in checked["divisions"] if d["kind"] == "heading"}
                for ref, v in SAMPLES:
                    text = checked["verses"].get(v, "")
                    head = f" [título: {titles[v][:60]}]" if v in titles else ""
                    print(f"    {ref}: {text[:110] or '(sem texto)'}{head}")
        except RuntimeError as e:
            failures.append(str(e))
            print(f"{bid}: NÃO EMPACOTADA: {e}")

    if failures:
        print(f"{len(failures)} Bíblia(s) fora do catálogo por versificação ou texto; manifesto não gravado.")
        sys.exit(1)
    manifest = manifest_for(entries, args.version)
    if not only:
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"manifesto: {MANIFEST} ({len(entries)} entradas)")


if __name__ == "__main__":
    main()
