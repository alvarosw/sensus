"""Ingere 'Gill's Exposition of the Entire Bible' (John Gill, 1748-1763) como 'gill' (kind 'commentary').

Fonte: módulo SWORD SIGILL (sigill.zip) preparado por SermonIndex.net, com DistributionLicense
'Public Domain' no .conf. O texto é o original do século XVIII. A edição 'Gill' do repositório
Xiphos (gill.zip, editor Larry Pierce) é modernizada e declara 'All Rightes Reserved': não é usada.

Mesmas regras de sword_commentaries.build_rows (fusão de versículos consecutivos iguais,
introduções em versículo 0, markup removido).

Uso:
    cd pipeline && .venv/bin/python -I ingest/gill.py
"""

import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import StagingWriter, cite_com  # noqa: E402
from ingest.sword_common import RAW, extract, open_module, raw_entries, read_conf, strip_markup  # noqa: E402
from ingest.sword_commentaries import build_rows  # noqa: E402

SOURCE_ID = "gill"
MODULE = "SIGILL"
URL = "https://sermonindex.net/modules/sword/sigill.zip"
PAGE = "https://www.sermonindex.net/commentary/gill/"
AUTHOR = "John Gill (1697-1771)"


def fetch(url: str, dest_dir: Path) -> Path:
    """Baixa <url> para dest_dir (pula se já existe)."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / url.rsplit("/", 1)[-1]
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    tmp = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(url, timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 16):
            f.write(chunk)
    tmp.rename(dest)
    return dest


def main():
    zip_path = fetch(URL, RAW / SOURCE_ID)
    root = extract(zip_path)
    conf = read_conf(root, MODULE)
    if conf.get("distributionlicense") != "Public Domain":
        raise RuntimeError(f"licença inesperada: {conf.get('distributionlicense')!r}")
    reader = open_module(conf)
    version = conf.get("version", "?")

    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="commentary",
            title="Gill's Exposition of the Entire Bible",
            author=AUTHOR,
            lang="en",
            license=conf["distributionlicense"],
            license_url=None,
            url=URL,
            version=f"SIGILL v{version} (SermonIndex.net)",
            attribution=(
                f"John Gill, An Exposition of the Entire Bible (1748-1763). Módulo SWORD {MODULE} "
                f"v{version} preparado por SermonIndex.net ({PAGE}); Public Domain conforme o .conf do módulo."
            ),
            tradition="reformed-baptist",
            notes=(
                f"Módulo SWORD {MODULE} preparado por SermonIndex.net; driver {conf['moddrv']}, "
                f"BlockType={conf.get('blocktype')}, SourceType={conf.get('sourcetype')}. "
                "Texto do original (1748-1763); a edição modernizada do módulo 'Gill' do repositório "
                "Xiphos declara All Rights Reserved e não foi usada. Versificação KJV. "
                "Notas de rodapé movidas para o fim de cada verbete como 'Nota: ...'. "
                "Versículos com texto idêntico consecutivo fundidos."
            ),
        )
        entries = ((v, strip_markup(raw)) for v, raw in raw_entries(reader))
        seen: set[str] = set()
        n_verse_rows = n_intro_rows = 0
        for start, end, text in build_rows(entries):
            base = cite_com(SOURCE_ID, start, end)
            cid, k = base, 2
            while cid in seen:
                cid = f"{base}.{k}"
                k += 1
            seen.add(cid)
            w.row("commentary", cite_id=cid, start_vid=start, end_vid=end, text=text)
            if start % 1000 == 0:
                n_intro_rows += 1
            else:
                n_verse_rows += 1
        print(f"[{SOURCE_ID}] intros={n_intro_rows} versiculos={n_verse_rows}")


if __name__ == "__main__":
    main()
