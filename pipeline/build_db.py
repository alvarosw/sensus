"""Monta o banco SQLite a partir de data/staging/*.

Uso:
    python build_db.py [--out ../data/sensus.db] [--books Phil,Col] [--sources a,b]

--books filtra comentários, verbetes, referências cruzadas e entidades para os livros dados
(verbetes de dicionário/léxico e entidades são mantidos apenas se referenciados
nesses livros, para reduzir o tamanho do banco do app).
"""

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from sensus.refs import BOOKS, book_num  # noqa: E402
from sensus.staging import SCHEMA, STAGING, ROOT  # noqa: E402

# Textos e tokens nunca são filtrados: referências cruzadas e concordância
# precisam do texto/ocorrências em toda a Bíblia.
VID_COLS = {
    "commentary": ["start_vid"], "entry_ref": ["start_vid"],
    "xref": ["from_vid"], "entity_ref": ["vid"],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "data" / "sensus.db"))
    ap.add_argument("--books", default="")
    ap.add_argument("--sources", default="")
    args = ap.parse_args()

    books = {book_num(b) for b in args.books.split(",") if b}
    only = {s for s in args.sources.split(",") if s}
    in_books = (lambda v: v // 1_000_000 in books) if books else (lambda v: True)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    db = sqlite3.connect(out)
    db.executescript(SCHEMA.read_text())
    db.executemany("INSERT INTO book VALUES (?,?,?,?,?,?)", [b[:6] for b in BOOKS])

    dirs = sorted(d for d in STAGING.iterdir() if d.is_dir() and (not only or d.name in only))
    for d in dirs:
        meta = json.loads((d / "source.json").read_text())
        db.execute(f"INSERT INTO source ({','.join(meta)}) VALUES ({','.join('?' * len(meta))})", list(meta.values()))
        for f in sorted(d.glob("*.jsonl")):
            table = f.stem
            n = skipped = 0
            with open(f, encoding="utf-8") as fh:
                for line in fh:
                    r = json.loads(line)
                    if any(not in_books(r[c]) for c in VID_COLS.get(table, [])):
                        skipped += 1
                        continue
                    db.execute(
                        f"INSERT OR IGNORE INTO {table} ({','.join(r)}) VALUES ({','.join('?' * len(r))})",
                        list(r.values()),
                    )
                    n += 1
            print(f"{d.name}/{table}: {n} linhas" + (f" ({skipped} fora do filtro)" if skipped else ""))

    if books:
        # Remove registros não versiculares sem vínculo com os livros escolhidos.
        db.executescript("""
            DELETE FROM dictionary_entry WHERE cite_id NOT IN (SELECT entry_cite_id FROM entry_ref);
            DELETE FROM entity WHERE cite_id NOT IN (SELECT entity_cite_id FROM entity_ref);
            DELETE FROM lexicon_entry WHERE strong_base IS NOT NULL
              AND strong_base NOT IN (SELECT strong_base FROM token WHERE strong_base IS NOT NULL);
        """)

    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.executemany("INSERT INTO meta VALUES (?,?)", [
        ("built_at", stamp), ("books", args.books or "all"), ("schema_version", "1"),
    ])
    db.commit()
    db.execute("VACUUM")
    db.close()
    print(f"→ {out} ({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
