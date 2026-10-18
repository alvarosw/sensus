"""Monta o banco SQLite a partir de data/staging/*.

Uso:
    python build_db.py [--edition full|reader] [--out ../data/sensus.db] [--books Phil,Col]
                       [--sources a,b] [--data-version 2026.10.11]

--out padrão depende da edição: data/sensus.db (full) ou data/sensus-reader.db (reader). Assim, o
build do reader não sobrescreve o banco completo.

Edições:
  full    (padrão) todas as fontes de data/staging, todos os livros. É o banco que o app baixa no
          primeiro uso (ver pipeline/package_data.py para o ZIP publicado).
  reader  subconjunto mínimo empacotado no APK, para o app funcionar offline antes do download:
          livros, fontes de texto (blivre, kjv, grc-tr, hbo-wlc), divisões de blivre e só os
          parágrafos de tagnt/tahot. As demais tabelas existem vazias, para o SQL do app não falhar.

Duas etapas:
  1. Carga lógica: staging -> tabelas descritas em pipeline/schema.sql.
  2. Layout físico: pipeline/schema_physical.sql compacta token e verse_text (que viram VIEWs de
     mesmo nome) e o banco é otimizado com ANALYZE e VACUUM.

--books filtra comentários, verbetes, referências cruzadas, entidades e léxico para os livros dados
(verbetes de dicionário e entidades são mantidos apenas se referenciados nesses livros). Sem --books,
nada é filtrado; em qualquer caso o léxico fica só com os strong_base presentes nos tokens, porque o
painel não alcança outros verbetes.
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
# Versão do esquema (meta.schema_version). Acompanha SUPPORTED_SCHEMA_VERSION em app/src/data/edition.ts:
# subir os dois juntos quando o layout mudar. 3 = xref compacta e view token_strong (pipeline/schema_physical.sql).
SCHEMA_VERSION = "3"
# Tamanho de página do arquivo final. Definido antes de criar tabelas.
PAGE_SIZE = 4096

EDITIONS = ("full", "reader")
READER_TEXT_SOURCES = ("blivre", "kjv", "grc-tr", "hbo-wlc")
# Do original, só os parágrafos (perícopes da unidade literária); o restante (tokens) fica de fora.
READER_PARAGRAPH_SOURCES = ("tagnt", "tahot")
READER_TABLES = {"verse_text", "text_division"}

# Textos e tokens nunca são filtrados: referências cruzadas e concordância
# precisam do texto/ocorrências em toda a Bíblia.
VID_COLS = {
    "commentary": ["start_vid"], "entry_ref": ["start_vid"],
    "xref": ["from_vid"], "entity_ref": ["vid"],
}


def default_out(edition: str) -> Path:
    """Saída padrão por edição: o reader nunca sobrescreve o banco completo."""
    name = "sensus-reader.db" if edition == "reader" else "sensus.db"
    return ROOT / "data" / name


def wanted(edition: str, source_id: str, table: str) -> bool:
    """A tabela desta fonte entra na edição? (full: tudo)."""
    if edition == "full":
        return True
    if table not in READER_TABLES:
        return False
    if table == "verse_text":
        return source_id in READER_TEXT_SOURCES
    return source_id in READER_TEXT_SOURCES or source_id in READER_PARAGRAPH_SOURCES


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--edition", choices=EDITIONS, default="full")
    ap.add_argument("--out", default="",
                    help="arquivo de saída; padrão: data/sensus.db (full) ou data/sensus-reader.db (reader)")
    ap.add_argument("--books", default="")
    ap.add_argument("--sources", default="")
    ap.add_argument("--data-version", default=datetime.now(timezone.utc).strftime("%Y.%m.%d"),
                    help="versão dos dados (AAAA.MM.DD por padrão); vai para meta.data_version")
    args = ap.parse_args()

    books = {book_num(b) for b in args.books.split(",") if b}
    only = {s for s in args.sources.split(",") if s}
    in_books = (lambda v: v // 1_000_000 in books) if books else (lambda v: True)

    out = Path(args.out) if args.out else default_out(args.edition)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    db = sqlite3.connect(out)
    db.execute(f"PRAGMA page_size = {PAGE_SIZE}")
    db.executescript(SCHEMA.read_text())
    db.executemany("INSERT INTO book VALUES (?,?,?,?,?,?)", [b[:6] for b in BOOKS])

    dirs = sorted(d for d in STAGING.iterdir() if d.is_dir() and (not only or d.name in only))
    if args.edition == "reader":
        dirs = [d for d in dirs if d.name in READER_TEXT_SOURCES + READER_PARAGRAPH_SOURCES]
    for d in dirs:
        meta = json.loads((d / "source.json").read_text())
        db.execute(f"INSERT INTO source ({','.join(meta)}) VALUES ({','.join('?' * len(meta))})", list(meta.values()))
        for f in sorted(d.glob("*.jsonl")):
            table = f.stem
            if not wanted(args.edition, d.name, table):
                continue
            n = skipped = ignored = 0
            with open(f, encoding="utf-8") as fh:
                for line in fh:
                    r = json.loads(line)
                    if any(not in_books(r[c]) for c in VID_COLS.get(table, [])):
                        skipped += 1
                        continue
                    if args.edition == "reader" and table == "text_division" and r["kind"] != "paragraph" \
                            and d.name in READER_PARAGRAPH_SOURCES:
                        skipped += 1
                        continue
                    cur = db.execute(
                        f"INSERT OR IGNORE INTO {table} ({','.join(r)}) VALUES ({','.join('?' * len(r))})",
                        list(r.values()),
                    )
                    if cur.rowcount == 0:
                        ignored += 1
                    n += 1
            extra = (f" ({skipped} fora do filtro)" if skipped else "") + (f" ({ignored} duplicadas ignoradas)" if ignored else "")
            print(f"{d.name}/{table}: {n} linhas{extra}")

    # entity_ref.token_pos é NULL quando a fonte não liga a palavra; a PK (SQLite) não deduplica
    # NULLs, então a deduplicação é feita aqui.
    dup = db.execute(
        "DELETE FROM entity_ref WHERE rowid NOT IN (SELECT MIN(rowid) FROM entity_ref "
        "GROUP BY entity_cite_id, vid, IFNULL(token_pos, -1))"
    ).rowcount
    if dup:
        print(f"entity_ref: {dup} duplicatas removidas")

    if books:
        # Remove registros não versiculares sem vínculo com os livros escolhidos.
        db.executescript("""
            DELETE FROM dictionary_entry WHERE cite_id NOT IN (SELECT entry_cite_id FROM entry_ref);
            DELETE FROM entity WHERE cite_id NOT IN (SELECT entity_cite_id FROM entity_ref);
        """)
    # Léxico: só os strong_base usados por tokens (com ou sem --books). O painel só alcança verbetes
    # pelo strong_base de um token; os demais seriam inalcançáveis.
    lex = db.execute("""
        DELETE FROM lexicon_entry WHERE strong_base IS NOT NULL
          AND strong_base NOT IN (SELECT strong_base FROM token WHERE strong_base IS NOT NULL)
    """).rowcount
    if lex:
        print(f"lexicon_entry: {lex} verbetes sem token correspondente removidos")

    # Nome pt só existe para entidade presente (--books ou --sources podem tê-la removido).
    nomes = db.execute("DELETE FROM entity_name WHERE cite_id NOT IN (SELECT cite_id FROM entity)").rowcount
    if nomes:
        print(f"entity_name: {nomes} nomes sem entidade removidos")

    # Layout físico. Conferências: a junção com src_code não pode descartar linhas.
    n_tok = db.execute("SELECT COUNT(*) FROM token").fetchone()[0]
    n_verse = db.execute("SELECT COUNT(*) FROM verse_text").fetchone()[0]
    n_xref = db.execute("SELECT COUNT(*) FROM xref").fetchone()[0]
    db.executescript(SCHEMA_PHYSICAL.read_text())
    assert db.execute("SELECT COUNT(*) FROM token_t").fetchone()[0] == n_tok, "token_t incompleta"
    assert db.execute("SELECT COUNT(*) FROM verse_t").fetchone()[0] == n_verse, "verse_t incompleta"
    assert db.execute("SELECT COUNT(*) FROM xref_t").fetchone()[0] == n_xref, "xref_t incompleta"

    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.executemany("INSERT INTO meta VALUES (?,?)", [
        ("built_at", stamp),
        ("books", args.books or "all"),
        ("edition", args.edition),
        ("data_version", args.data_version),
        ("schema_version", SCHEMA_VERSION),
    ])
    db.commit()
    db.execute("ANALYZE")
    db.execute("VACUUM")
    db.close()
    print(f"→ {out} ({out.stat().st_size / 1e6:.1f} MB, edição {args.edition}, dados {args.data_version})")


if __name__ == "__main__":
    main()
