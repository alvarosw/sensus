"""Gravação de dados normalizados em data/staging/<source_id>/<tabela>.jsonl.

Cada ingestor escreve apenas no seu próprio diretório de staging; o builder
(build_db.py) junta tudo no SQLite. As colunas são validadas contra schema.sql.
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGING = ROOT / "data" / "staging"
RAW = ROOT / "data" / "raw"
SCHEMA = Path(__file__).resolve().parents[1] / "schema.sql"


def schema_columns() -> dict[str, list[str]]:
    sql = SCHEMA.read_text()
    tables = {}
    for name, body in re.findall(r"CREATE TABLE (\w+) \((.*?)\n\);", sql, re.S):
        cols = []
        for line in body.splitlines():
            line = re.sub(r"--.*", "", line).strip()
            m = re.match(r"^(\w+)\s+(TEXT|INTEGER|REAL)", line)
            if m:
                cols.append(m.group(1))
        tables[name] = cols
    return tables


_COLUMNS = schema_columns()


# ---- cite_id ---------------------------------------------------------------

def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def cite_txt(source_id, vid): return f"txt:{source_id}:{vid}"
def cite_tok(corpus, vid, pos): return f"tok:{corpus}:{vid}:{pos}"
def cite_lex(source_id, key): return f"lex:{source_id}:{key}"
def cite_com(source_id, start, end): return f"com:{source_id}:{start}-{end}"
def cite_dic(source_id, key): return f"dic:{source_id}:{slug(key)}"
def cite_xr(source_id, frm, start, end): return f"xr:{source_id}:{frm}:{start}-{end}"
def cite_ent(source_id, ident): return f"ent:{source_id}:{ident}"


# ---- writer ----------------------------------------------------------------

class StagingWriter:
    """Uso:
        with StagingWriter("blivre") as w:
            w.source(kind="text", title=..., lang="pt", license=..., url=...)
            w.row("verse_text", cite_id=..., vid=..., text=...)
    source_id é preenchido automaticamente nas tabelas que o possuem.
    """

    def __init__(self, source_id: str):
        self.source_id = source_id
        self.dir = STAGING / source_id
        self.dir.mkdir(parents=True, exist_ok=True)
        for f in self.dir.glob("*.jsonl"):
            f.unlink()
        self._files = {}
        self.counts: dict[str, int] = {}
        self._has_source = False

    def source(self, **meta):
        meta.setdefault("retrieved_at", datetime.now(timezone.utc).isoformat(timespec="seconds"))
        meta["id"] = self.source_id
        self._check("source", meta)
        for req in ("kind", "title", "lang", "license", "url"):
            if not meta.get(req):
                raise ValueError(f"source.{req} é obrigatório")
        (self.dir / "source.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2))
        self._has_source = True

    def row(self, table: str, **values):
        if table in ("source", "book", "meta"):
            raise ValueError(f"tabela {table} não é escrita por ingestores")
        if "source_id" in _COLUMNS[table]:
            values.setdefault("source_id", self.source_id)
        self._check(table, values)
        f = self._files.get(table)
        if f is None:
            f = self._files[table] = open(self.dir / f"{table}.jsonl", "w", encoding="utf-8")
        f.write(json.dumps(values, ensure_ascii=False) + "\n")
        self.counts[table] = self.counts.get(table, 0) + 1

    def _check(self, table, values):
        if table not in _COLUMNS:
            raise ValueError(f"tabela desconhecida: {table}")
        extra = set(values) - set(_COLUMNS[table])
        if extra:
            raise ValueError(f"colunas inexistentes em {table}: {sorted(extra)}")

    def close(self):
        for f in self._files.values():
            f.close()
        if not self._has_source:
            raise RuntimeError("chame w.source(...) antes de fechar")
        print(f"[{self.source_id}] " + ", ".join(f"{t}={n}" for t, n in sorted(self.counts.items())))

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *_):
        if exc_type is None:
            self.close()
        else:
            for f in self._files.values():
                f.close()
