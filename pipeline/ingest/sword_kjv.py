"""Ingere o KJV do CrossWire SWORD (módulo KJV) como verse_text (source 'kjv').

Uso: cd pipeline && .venv/bin/python -I ingest/sword_kjv.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import StagingWriter, cite_txt  # noqa: E402
from ingest.sword_common import (  # noqa: E402
    BASE_URL, download, extract, open_module, raw_entries, read_conf, strip_markup,
)

SOURCE_ID = "kjv"
MODULE = "KJV"
ZIP = "KJV.zip"


def main():
    zip_path = download(ZIP, SOURCE_ID)
    root = extract(zip_path)
    conf = read_conf(root, MODULE)
    reader = open_module(conf)

    license_ = conf.get("distributionlicense", "")
    with StagingWriter(SOURCE_ID) as w:
        w.source(
            kind="text",
            title="King James Version (1769), com números de Strong e morfologia (SWORD KJV)",
            author="Tradutores da King James Version (1611); revisão de 1769",
            lang="en",
            license=license_,  # conf do módulo: 'GPL' (ver notes)
            license_url=None,
            url=BASE_URL + ZIP,
            version=f"{conf['version']} (SwordVersionDate {conf.get('swordversiondate', '?')})",
            attribution=(
                "Texto KJV do módulo SWORD 'KJV' (CrossWire Bible Society). "
                "Licença declarada no .conf do módulo: GPL. "
                "O texto-base da KJV é de domínio público; o Crown copyright do Reino Unido "
                "é mencionado no About do módulo."
            ),
            notes=(
                f"Módulo SWORD {MODULE} v{conf['version']}; driver {conf['moddrv']}, "
                f"BlockType={conf.get('blocktype')}. Texto limpo de OSIS (Strong/morfologia/"
                "milestones removidos). Apenas versículos (vid com versículo > 0); "
                "Notas de rodapé descartadas; títulos de salmos ficam no início do versículo 1."
            ),
        )

        empty = 0
        for v, raw in raw_entries(reader):
            if v % 1000 == 0:  # introduções/cabeçalhos (versículo 0)
                continue
            text = strip_markup(raw, keep_notes=False)
            if not text:
                empty += 1
                continue
            w.row("verse_text", cite_id=cite_txt(SOURCE_ID, v), vid=v, text=text)

        print(f"[{SOURCE_ID}] versículos vazios no módulo: {empty}")


if __name__ == "__main__":
    main()
