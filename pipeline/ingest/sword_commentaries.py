"""Ingere comentários bíblicos dos módulos CrossWire SWORD (kind 'commentary', lang 'en').

Uma source por módulo: 'sword-<modulo minúsculo>'. Versículos consecutivos com o mesmo
texto são fundidos em um registro (start_vid..end_vid); introduções de livro e de
capítulo (versículo 0) viram registros start=end.

Módulos ignorados (ver SKIPPED): licença não pública/não redistribuível ou ausentes.

Uso:
    cd pipeline && .venv/bin/python -I ingest/sword_commentaries.py [Modulo1,Modulo2]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sensus.staging import StagingWriter, cite_com  # noqa: E402
from ingest.sword_common import (  # noqa: E402
    BASE_URL, conf_plain, download, extract, open_module, raw_entries, read_conf, strip_contacts,
    strip_emails, strip_markup,
)

# (módulo SWORD, zip no repositório, tradição, autor)
MODULES = [
    ("MHC", "MHC.zip", "reformed", "Matthew Henry (1662-1714)"),
    ("Barnes", "Barnes.zip", "presbyterian", "Albert Barnes (1798-1870)"),
    ("JFB", "JFB.zip", "reformed", "Robert Jamieson, A. R. Fausset, David Brown (1871)"),
    ("Scofield", "Scofield.zip", "dispensational", "C. I. Scofield (1843-1921)"),
    ("KD", "KD.zip", "lutheran", "Karl Friedrich Keil (1807-1888) e Franz Delitzsch (1813-1890)"),
    ("CalvinCommentaries", "CalvinCommentaries.zip", "reformed", "João Calvin (1509-1564)"),
    ("Clarke", "Clarke.zip", "methodist", "Adam Clarke (1762-1832)"),
    ("Wesley", "Wesley.zip", "methodist", "John Wesley (1703-1791)"),
    ("RWP", "RWP.zip", "baptist", "A. T. Robertson (1863-1934)"),
]

# Módulos com licença diferente de 'Public Domain', aprovados pelo responsável do projeto
# (app comunitário e não comercial). O campo license é sempre o texto exato do .conf.
APPROVED_LICENSES = {
    "RWP": {
        "license": "Copyrighted; Free non-commercial distribution",
        "notes": ("Distribuição livre apenas não comercial; uso aprovado pelo responsável do projeto "
                  "(app comunitário, não comercial). "),
        "attribution": ("Vols. 5 e 6: (c) 1932 e 1933 Broadman Press, renovação 1960, usado com permissão "
                        "(conforme About do módulo)."),
    },
}

# Ignorados (reportados ao usuário):
SKIPPED = {
    "Gill": "não existe no repositório CrossWire (rawzip); ver ingest/gill.py",
    "Geneva": "conf sem DistributionLicense (notas da Bíblia de Genebra; licença não declarada)",
    "TSK": "fora do escopo deste ingestor (outro agente)",
}


def build_rows(entries):
    """Converte os slots de um módulo em registros de comentário.

    entries: iterável de (vid, texto_limpo) na ordem SWORD (todos os slots).
    - Versículos consecutivos com texto idêntico (mesmo livro) são fundidos (start..end).
    - Introduções (versículo 0) geram registro próprio, exceto se o texto repete um
      versículo ou outra introdução do módulo (ponteiro para registro anterior).
    - Um trecho fundido (2+ versículos) que começa em 1:1 de um livro e cujo texto já
      aparece em um livro anterior é descartado: módulos com versículos sem nota apontam
      para o registro anterior (ex.: Wesley, Js 23:16 repetido em Juízes 1:1-21:25).
      Notas repetidas dentro do livro e referências isoladas (ex.: Scofield) são mantidas.
    Gera (start_vid, end_vid, texto).
    """
    entries = list(entries)
    first_book: dict[str, int] = {}
    intro_counts: dict[str, int] = {}
    for v, t in entries:
        if not t:
            continue
        if v % 1000:
            first_book.setdefault(t, v // 1_000_000)  # slots estão em ordem canônica
        else:
            intro_counts[t] = intro_counts.get(t, 0) + 1

    def emit(start, end, text):
        starts_book = start % 1_000_000 == 1001  # 1:1 do livro
        if end != start and starts_book and first_book.get(text, start // 1_000_000) < start // 1_000_000:
            return None
        return start, end, text

    run = None  # [start, end, texto]
    for v, text in entries:
        if v % 1000 == 0:
            if text and text not in first_book and intro_counts[text] == 1:
                yield v, v, text
            continue
        if run is not None and text and text == run[2] and v // 1_000_000 == run[0] // 1_000_000:
            run[1] = v
            continue
        if run is not None:
            row = emit(*run)
            if row:
                yield row
        run = [v, v, text] if text else None
    if run is not None:
        row = emit(*run)
        if row:
            yield row


def ingest(name: str, zip_name: str, tradition: str, author: str) -> None:
    source_id = f"sword-{name.lower()}"
    zip_path = download(zip_name, source_id)
    root = extract(zip_path)
    conf = read_conf(root, name)
    approved = APPROVED_LICENSES.get(name, {})
    expected_license = approved.get("license", "Public Domain")
    if conf.get("distributionlicense") != expected_license:
        raise RuntimeError(f"{name}: licença inesperada: {conf.get('distributionlicense')!r}")
    reader = open_module(conf)
    about = conf_plain(conf.get("about", ""))
    text_source = conf.get("textsource", "")

    with StagingWriter(source_id) as w:
        w.source(
            kind="commentary",
            title=conf.get("description", name),
            author=author,
            lang="en",
            license=conf["distributionlicense"],
            license_url=None,
            url=BASE_URL + zip_name,
            version=f"{conf['version']} (SwordVersionDate {conf.get('swordversiondate', '?')})",
            attribution=(
                f"{conf.get('description', name)}, {author}. Módulo SWORD {name} v{conf['version']} "
                f"(CrossWire Bible Society), {expected_license} conforme o .conf do módulo."
                + (f" {approved['attribution']}" if approved.get("attribution") else "")
                + (f" Fonte do texto: {text_source}." if text_source else "")
            ),
            tradition=tradition,
            notes=(
                approved.get("notes", "")
                + f"Módulo SWORD {name}; driver {conf['moddrv']}, BlockType={conf.get('blocktype')}, "
                f"SourceType={conf.get('sourcetype')}. Versificação KJV. Notas de rodapé movidas para o "
                "fim de cada verbete como 'Nota: ...'. Versículos com texto idêntico consecutivo fundidos. "
                + (about[:400] if about else "")
            ),
        )
        # Introduções (versículo 0) são front matter: saem também telefone e endereço postal.
        entries = (
            (v, strip_contacts(strip_markup(raw)) if v % 1000 == 0 else strip_emails(strip_markup(raw)))
            for v, raw in raw_entries(reader)
        )
        seen: set[str] = set()
        n_verse_rows = n_intro_rows = 0
        for start, end, text in build_rows(entries):
            base = cite_com(source_id, start, end)
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
        print(f"[{source_id}] intros={n_intro_rows} versiculos={n_verse_rows}")


def main():
    only = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    for name, zip_name, tradition, author in MODULES:
        if only and name not in only:
            continue
        ingest(name, zip_name, tradition, author)
    for name, why in SKIPPED.items():
        print(f"[skip] {name}: {why}")


if __name__ == "__main__":
    main()
