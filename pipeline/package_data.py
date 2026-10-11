"""Empacota o banco completo para o GitHub Releases e grava data-manifest.json (raiz do repositório).

Uso (a partir de pipeline/):
    python3 package_data.py [--db ../data/sensus.db] [--min-app-version 1.0.0]

Saídas:
    ../dist/data/sensus-full-<data_version>.zip   ZIP com deflate e uma única entrada: sensus.db
    ../data-manifest.json                          lido pelo app (app/src/data/manifest.ts)

O manifesto segue o contrato de parseManifest: schema_version é inteiro, sha256 é hex de 64 caracteres
e size/uncompressed_size são bytes (size = ZIP, uncompressed_size = sensus.db). O ZIP é conferido
depois de escrito (uma entrada, CRC íntegro, tamanho igual ao do banco).
"""

import argparse
import hashlib
import json
import sqlite3
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from sensus.staging import ROOT  # noqa: E402

GITHUB_REPO = "alvarosw/sensus"
ENTRY = "sensus.db"


def read_meta(db_path: Path) -> dict[str, str]:
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        return dict(con.execute("SELECT key, value FROM meta").fetchall())
    finally:
        con.close()


def digests_of(path: Path) -> tuple[str, str]:
    """(sha256, md5) do arquivo numa só leitura em blocos. O md5 é o que o app confere no aparelho (nativo, rápido)."""
    sha, md5 = hashlib.sha256(), hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            sha.update(chunk)
            md5.update(chunk)
    return sha.hexdigest(), md5.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(ROOT / "data" / "sensus.db"))
    ap.add_argument("--out-dir", default=str(ROOT / "dist" / "data"))
    ap.add_argument("--manifest", default=str(ROOT / "data-manifest.json"))
    ap.add_argument("--min-app-version", default="", help="padrão: version de app/package.json")
    args = ap.parse_args()

    db = Path(args.db)
    meta = read_meta(db)
    if meta.get("edition") != "full":
        sys.exit(f"{db} não é o banco completo (meta.edition={meta.get('edition')!r}); gere com --edition full")
    version = meta["data_version"]
    schema = int(meta["schema_version"])
    min_app = args.min_app_version or json.loads((ROOT / "app" / "package.json").read_text())["version"]

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / f"sensus-full-{version}.zip"
    part = zip_path.with_suffix(".zip.part")
    with zipfile.ZipFile(part, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.write(db, arcname=ENTRY)
    with zipfile.ZipFile(part) as z:
        assert z.namelist() == [ENTRY], z.namelist()
        assert z.testzip() is None, "CRC inválido"
        assert z.getinfo(ENTRY).file_size == db.stat().st_size, "tamanho descompactado diferente"
    part.replace(zip_path)

    sha256, md5 = digests_of(zip_path)
    manifest = {
        "data_version": version,
        "schema_version": schema,
        "full": {
            "url": f"https://github.com/{GITHUB_REPO}/releases/download/data-{version}/{zip_path.name}",
            "md5": md5,
            "sha256": sha256,
            "size": zip_path.stat().st_size,
            "uncompressed_size": db.stat().st_size,
        },
        "min_app_version": min_app,
    }
    Path(args.manifest).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{zip_path} ({manifest['full']['size'] / 1e6:.1f} MB; banco {manifest['full']['uncompressed_size'] / 1e6:.1f} MB)")
    print(f"sha256 {manifest['full']['sha256']}  md5 {manifest['full']['md5']}")
    print(f"manifesto: {args.manifest} (data_version {version}, schema {schema}, app >= {min_app})")


if __name__ == "__main__":
    main()
