"""Monta o banco SQLite a partir de data/staging/*.

Uso:
    python build_db.py [--out ../data/sensus.db] [--books Phil,Col] [--sources a,b]

Duas etapas:
  1. Carga lógica: staging -> tabelas descritas em pipeline/schema.sql.
  2. Layout físico: pipeline/schema_physical.sql compacta token e verse_text (que viram VIEWs de
     mesmo nome) e o banco é otimizado com ANALYZE e VACUUM.

--books filtra comentários, verbetes, referências cruzadas, entidades e léxico para os livros dados
(verbetes de dicionário/léxico e entidades são mantidos apenas se referenciados nesses livros,
para reduzir o tamanho do banco do app).
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

SCHEMA_PHYSICAL = Path(__file__).resolve().parent / "schema_physical.sql"
SCHEMA_VERSION = "2"
# Tamanho de página do arquivo final. Definido antes de criar tabelas.
PAGE_SIZE = 4096

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
    db.execute(f"PRAGMA page_size = {PAGE_SIZE}")
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

    # entity_ref.token_pos é NULL quando a fonte não liga a palavra; a PK (SQLite) não deduplica
    # NULLs, então a deduplicação é feita aqui.
    dup = db.execute(
        "DELETE FROM entity_ref WHERE rowid NOT IN (SELECT MIN(rowid) FROM entity_ref "
        "GROUP BY entity_cite_id, vid, IFNULL(token_pos, -1))"
    ).rowcount
    if dup:
        print(f"entity_ref: {dup} duplicatas removidas")

    if books:
        # Remove registros não versiculares sem vínculo com os livros escolhidos. Léxico: só os
        # strong_base usados por tokens dos livros escolhidos (tokens de todos os livros são mantidos).
        book_list = ",".join(str(b) for b in sorted(books))
        db.executescript(f"""
            DELETE FROM dictionary_entry WHERE cite_id NOT IN (SELECT entry_cite_id FROM entry_ref);
            DELETE FROM entity WHERE cite_id NOT IN (SELECT entity_cite_id FROM entity_ref);
            DELETE FROM lexicon_entry WHERE strong_base IS NOT NULL
              AND strong_base NOT IN (
                SELECT strong_base FROM token WHERE strong_base IS NOT NULL);
            -- (léxico mantido para todo o corpus presente: o leitor mostra o original de qualquer livro)
        """)

    # Layout físico. Conferências: a junção com src_code não pode descartar linhas.
    n_tok = db.execute("SELECT COUNT(*) FROM token").fetchone()[0]
    n_verse = db.execute("SELECT COUNT(*) FROM verse_text").fetchone()[0]
    db.executescript(SCHEMA_PHYSICAL.read_text())
    assert db.execute("SELECT COUNT(*) FROM token_t").fetchone()[0] == n_tok, "token_t incompleta"
    assert db.execute("SELECT COUNT(*) FROM verse_t").fetchone()[0] == n_verse, "verse_t incompleta"

    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.executemany("INSERT INTO meta VALUES (?,?)", [
        ("built_at", stamp), ("books", args.books or "all"), ("schema_version", SCHEMA_VERSION),
    ])
    db.commit()
    db.execute("ANALYZE")
    db.execute("VACUUM")
    db.close()
    print(f"→ {out} ({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
